// src/routes/ai.ts - IA integrada com OpenAI (sem vínculo com Genspark)
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database; OPENAI_API_KEY: string }
type Variables = { user: any }

const ai = new Hono<{ Bindings: Bindings; Variables: Variables }>()
ai.use('*', requireAuth)

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

async function callOpenAI(apiKey: string, messages: any[], systemPrompt: string): Promise<string> {
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada. Configure nas variáveis de ambiente.')

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const err = await response.json() as any
    throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`)
  }

  const data = await response.json() as any
  return data.choices[0].message.content
}

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `Você é o Assistente IA do CRM Saúde PRO, especializado em corretagem de planos de saúde no Brasil.
Ajude os corretores com: análise de leads, scripts de vendas, superação de objeções, estratégias de negociação e insights sobre o mercado de saúde.
Responda sempre em português brasileiro, de forma profissional, clara e objetiva.`,

  script: `Você é especialista em scripts de vendas para planos de saúde.
Crie scripts persuasivos, naturais e éticos para diferentes situações: primeiro contato, qualificação, apresentação de proposta e fechamento.
Considere as melhores práticas do setor de saúde suplementar.
Responda sempre em português brasileiro.`,

  lead_analysis: `Você é especialista em análise de perfil de leads para planos de saúde.
Analise as informações fornecidas e gere insights sobre: potencial de conversão, necessidades do cliente, melhor abordagem, possíveis objeções e recomendações de planos.
Responda sempre em português brasileiro.`,

  report: `Você é especialista em análise de desempenho comercial no setor de saúde suplementar.
Analise os dados fornecidos e gere relatórios detalhados com insights, pontos de atenção e recomendações estratégicas.
Use linguagem profissional e apresente dados de forma clara.
Responda sempre em português brasileiro.`,

  objection: `Você é especialista em superação de objeções para vendas de planos de saúde.
Forneça respostas eficazes e éticas para as objeções mais comuns como: preço alto, já tem plano, precisa pensar, etc.
Adapte as respostas ao contexto do corretor brasileiro.
Responda sempre em português brasileiro.`
}

// Chat principal com IA
ai.post('/chat', async (c) => {
  try {
    const user = c.get('user')
    const { message, context_type = 'general', lead_id, session_id } = await c.req.json()

    if (!message) return c.json({ error: 'Mensagem obrigatória' }, 400)

    const sid = session_id || generateId()
    const apiKey = c.env.OPENAI_API_KEY

    // Buscar histórico da conversa
    const { results: history } = await c.env.DB.prepare(
      'SELECT role, content FROM ai_conversations WHERE session_id = ? ORDER BY created_at ASC LIMIT 10'
    ).bind(sid).all() as any

    // Buscar dados do lead se fornecido
    let leadContext = ''
    if (lead_id) {
      const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(lead_id).first() as any
      if (lead) {
        leadContext = `\n\nContexto do Lead:\nNome: ${lead.name}\nTipo: ${lead.lead_type}\nEstágio: ${lead.pipeline_stage}\nValor estimado: R$${lead.estimated_value}\nNotas: ${lead.notes || 'Nenhuma'}`
      }
    }

    const systemPrompt = (SYSTEM_PROMPTS[context_type] || SYSTEM_PROMPTS.general) + leadContext

    const messages = [...history.map((h: any) => ({ role: h.role, content: h.content })), { role: 'user', content: message }]

    const response = await callOpenAI(apiKey, messages.slice(-10), systemPrompt)

    // Salvar no histórico
    await c.env.DB.prepare(
      'INSERT INTO ai_conversations (id, user_id, lead_id, session_id, role, content, context_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), user.userId, lead_id || null, sid, 'user', message, context_type).run()

    await c.env.DB.prepare(
      'INSERT INTO ai_conversations (id, user_id, lead_id, session_id, role, content, context_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), user.userId, lead_id || null, sid, 'assistant', response, context_type).run()

    return c.json({ response, session_id: sid })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Gerar script de vendas
ai.post('/script', async (c) => {
  try {
    const user = c.get('user')
    const { lead_type, stage, client_profile, objective } = await c.req.json()

    const apiKey = c.env.OPENAI_API_KEY
    const prompt = `Crie um script de vendas para:
- Tipo de plano: ${lead_type === 'pf' ? 'Pessoa Física' : lead_type === 'pme' ? 'PME/Empresarial' : 'Adesão'}
- Estágio: ${stage || 'Primeiro contato'}
- Perfil do cliente: ${client_profile || 'Não informado'}
- Objetivo: ${objective || 'Agendar reunião / fechar venda'}

Estruture o script com: abertura, sondagem, apresentação de valor, manejo de objeções e fechamento.`

    const response = await callOpenAI(apiKey, [{ role: 'user', content: prompt }], SYSTEM_PROMPTS.script)

    return c.json({ script: response })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Analisar perfil do lead
ai.post('/analyze-lead', async (c) => {
  try {
    const user = c.get('user')
    const { lead_id } = await c.req.json()

    const lead = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(lead_id).first() as any
    if (!lead) return c.json({ error: 'Lead não encontrado' }, 404)

    const { results: activities } = await c.env.DB.prepare(
      'SELECT type, title, outcome FROM activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(lead_id).all()

    const apiKey = c.env.OPENAI_API_KEY
    const prompt = `Analise este lead e forneça insights detalhados:

Dados do Lead:
- Nome: ${lead.name}
- Tipo: ${lead.lead_type === 'pf' ? 'Pessoa Física' : lead.lead_type === 'pme' ? 'PME' : 'Adesão'}
- Estágio atual: ${lead.pipeline_stage}
- Valor estimado: R$${lead.estimated_value}
- Origem: ${lead.source || 'Não informado'}
- Empresa: ${lead.company_name || 'N/A'}
- Qtd. Vidas: ${lead.lives_count}
- Plano atual: ${lead.current_plan || 'Não tem'}
- Plano desejado: ${lead.desired_plan || 'A definir'}
- Notas: ${lead.notes || 'Nenhuma'}
- Atividades recentes: ${activities.map((a: any) => `${a.type}: ${a.title}`).join(', ') || 'Nenhuma'}

Forneça: 1) Potencial de conversão (Alto/Médio/Baixo com justificativa), 2) Necessidades identificadas, 3) Estratégia recomendada, 4) Possíveis objeções, 5) Próximas ações sugeridas.`

    const analysis = await callOpenAI(apiKey, [{ role: 'user', content: prompt }], SYSTEM_PROMPTS.lead_analysis)

    return c.json({ analysis, lead_name: lead.name })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Gerar relatório com IA
ai.post('/report', async (c) => {
  try {
    const user = c.get('user')
    const { report_data, report_type = 'performance' } = await c.req.json()

    const apiKey = c.env.OPENAI_API_KEY
    const prompt = `Analise estes dados de performance de um corretor de planos de saúde e gere um relatório executivo:

${JSON.stringify(report_data, null, 2)}

Inclua: 1) Resumo executivo, 2) Pontos fortes, 3) Pontos de melhoria, 4) Análise do pipeline, 5) Recomendações estratégicas, 6) Metas sugeridas para o próximo período.`

    const report = await callOpenAI(apiKey, [{ role: 'user', content: prompt }], SYSTEM_PROMPTS.report)

    // Salvar relatório
    const id = 'rep_ai_' + generateId().replace(/-/g, '').substring(0, 10)
    await c.env.DB.prepare(
      'INSERT INTO reports (id, user_id, type, title, content, data, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user.userId, 'ai_generated', `Relatório IA - ${new Date().toLocaleDateString('pt-BR')}`, report, JSON.stringify(report_data), 'generated').run()

    return c.json({ report, id })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Suporte com objeções
ai.post('/objections', async (c) => {
  try {
    const { objection, lead_type, context } = await c.req.json()
    const apiKey = c.env.OPENAI_API_KEY

    const prompt = `O cliente disse: "${objection}"
Contexto: ${context || 'Venda de plano de saúde'}
Tipo de plano: ${lead_type || 'Não especificado'}

Forneça 3 respostas diferentes para superar esta objeção, do mais conservador ao mais arrojado, todas éticas e honestas.`

    const response = await callOpenAI(apiKey, [{ role: 'user', content: prompt }], SYSTEM_PROMPTS.objection)
    return c.json({ response })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Histórico de conversas
ai.get('/history', async (c) => {
  const user = c.get('user')
  const { session_id } = c.req.query()

  let query = 'SELECT * FROM ai_conversations WHERE user_id = ?'
  const params: any[] = [user.userId]

  if (session_id) { query += ' AND session_id = ?'; params.push(session_id) }
  query += ' ORDER BY created_at DESC LIMIT 50'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ conversations: results })
})

// Limpar histórico de sessão
ai.delete('/history/:session_id', async (c) => {
  const user = c.get('user')
  const { session_id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM ai_conversations WHERE session_id = ? AND user_id = ?').bind(session_id, user.userId).run()
  return c.json({ success: true })
})

export default ai
