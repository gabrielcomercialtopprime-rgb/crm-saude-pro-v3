// src/routes/leads.ts
import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const leads = new Hono<{ Bindings: Bindings; Variables: Variables }>()
leads.use('*', requireAuth)

// Listar leads com filtros
leads.get('/', async (c) => {
  const user = c.get('user')
  const { type, stage, search, assigned_to, priority, page = '1', limit = '20' } = c.req.query()
  
  let query = `SELECT l.*, u.name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE 1=1`
  const params: any[] = []

  // Corretores só veem seus próprios leads
  if (user.role === 'broker') {
    query += ' AND (l.assigned_to = ? OR l.created_by = ?)'
    params.push(user.userId, user.userId)
  }

  if (type) { query += ' AND l.lead_type = ?'; params.push(type) }
  if (stage) { query += ' AND l.pipeline_stage = ?'; params.push(stage) }
  if (priority) { query += ' AND l.priority = ?'; params.push(priority) }
  if (assigned_to) { query += ' AND l.assigned_to = ?'; params.push(assigned_to) }
  if (search) {
    query += ' AND (l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.company_name LIKE ?)'
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  query += ' ORDER BY l.updated_at DESC'
  
  const offset = (parseInt(page) - 1) * parseInt(limit)
  query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ leads: results })
})

// Criar lead
leads.post('/', async (c) => {
  try {
    const user = c.get('user')
    const data = await c.req.json()
    
    const id = 'lead_' + generateId().replace(/-/g, '').substring(0, 12)
    const {
      name, email, phone, cpf, cnpj, birth_date, lead_type, source,
      company_name, company_size, estimated_value, monthly_premium,
      lives_count, current_plan, desired_plan, operator, address, city,
      state, zip_code, notes, priority, assigned_to
    } = data

    if (!name || !phone || !lead_type) return c.json({ error: 'Nome, telefone e tipo são obrigatórios' }, 400)

    await c.env.DB.prepare(`
      INSERT INTO leads (id, name, email, phone, cpf, cnpj, birth_date, lead_type, pipeline_stage, source,
        company_name, company_size, estimated_value, monthly_premium, lives_count, current_plan, desired_plan,
        operator, address, city, state, zip_code, notes, priority, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new_lead', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, name, email || null, phone, cpf || null, cnpj || null, birth_date || null, lead_type, source || null,
      company_name || null, company_size || null, estimated_value || 0, monthly_premium || 0,
      lives_count || 1, current_plan || null, desired_plan || null, operator || null,
      address || null, city || null, state || null, zip_code || null, notes || null,
      priority || 'medium', assigned_to || user.userId, user.userId
    ).run()

    // Registrar no histórico do pipeline
    await c.env.DB.prepare(
      'INSERT INTO pipeline_history (id, lead_id, user_id, from_stage, to_stage, reason) VALUES (?, ?, ?, NULL, ?, ?)'
    ).bind(generateId(), id, user.userId, 'new_lead', 'Lead criado').run()

    // Criar notificação
    if (assigned_to && assigned_to !== user.userId) {
      await c.env.DB.prepare(
        'INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(generateId(), assigned_to, 'Novo Lead Atribuído', `O lead "${name}" foi atribuído a você`, 'lead', `/leads/${id}`).run()
    }

    return c.json({ success: true, id }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Buscar lead por ID
leads.get('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  let query = `SELECT l.*, u.name as assigned_name, u2.name as creator_name 
    FROM leads l 
    LEFT JOIN users u ON l.assigned_to = u.id 
    LEFT JOIN users u2 ON l.created_by = u2.id
    WHERE l.id = ?`
  
  const params: any[] = [id]
  if (user.role === 'broker') {
    query += ' AND (l.assigned_to = ? OR l.created_by = ?)'
    params.push(user.userId, user.userId)
  }

  const lead = await c.env.DB.prepare(query).bind(...params).first()
  if (!lead) return c.json({ error: 'Lead não encontrado' }, 404)

  // Buscar atividades do lead
  const { results: activities } = await c.env.DB.prepare(
    'SELECT a.*, u.name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.lead_id = ? ORDER BY a.created_at DESC LIMIT 20'
  ).bind(id).all()

  // Buscar propostas do lead
  const { results: proposals } = await c.env.DB.prepare(
    'SELECT p.*, u.name as user_name FROM proposals p LEFT JOIN users u ON p.user_id = u.id WHERE p.lead_id = ? ORDER BY p.created_at DESC'
  ).bind(id).all()

  // Buscar histórico pipeline
  const { results: history } = await c.env.DB.prepare(
    'SELECT ph.*, u.name as user_name FROM pipeline_history ph LEFT JOIN users u ON ph.user_id = u.id WHERE ph.lead_id = ? ORDER BY ph.created_at DESC'
  ).bind(id).all()

  return c.json({ lead, activities, proposals, history })
})

// Atualizar lead
leads.put('/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const user = c.get('user')
    const data = await c.req.json()

    const existing = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first() as any
    if (!existing) return c.json({ error: 'Lead não encontrado' }, 404)

    const {
      name, email, phone, cpf, cnpj, birth_date, source, company_name, company_size,
      estimated_value, monthly_premium, lives_count, current_plan, desired_plan,
      operator, address, city, state, zip_code, notes, priority, assigned_to, status
    } = data

    await c.env.DB.prepare(`
      UPDATE leads SET name=?, email=?, phone=?, cpf=?, cnpj=?, birth_date=?, source=?,
      company_name=?, company_size=?, estimated_value=?, monthly_premium=?, lives_count=?,
      current_plan=?, desired_plan=?, operator=?, address=?, city=?, state=?, zip_code=?,
      notes=?, priority=?, assigned_to=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).bind(
      name, email || null, phone, cpf || null, cnpj || null, birth_date || null, source || null,
      company_name || null, company_size || null, estimated_value || 0, monthly_premium || 0,
      lives_count || 1, current_plan || null, desired_plan || null, operator || null,
      address || null, city || null, state || null, zip_code || null, notes || null,
      priority || 'medium', assigned_to || null, status || 'active', id
    ).run()

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Mover estágio no pipeline
leads.patch('/:id/stage', async (c) => {
  try {
    const { id } = c.req.param()
    const user = c.get('user')
    const { stage, reason } = await c.req.json()

    const validStages = ['new_lead', 'first_contact', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    if (!validStages.includes(stage)) return c.json({ error: 'Estágio inválido' }, 400)

    const lead = await c.env.DB.prepare('SELECT pipeline_stage FROM leads WHERE id = ?').bind(id).first() as any
    if (!lead) return c.json({ error: 'Lead não encontrado' }, 404)

    const closedAt = ['closed_won', 'closed_lost'].includes(stage) ? 'CURRENT_TIMESTAMP' : null

    await c.env.DB.prepare(
      `UPDATE leads SET pipeline_stage = ?, closed_at = ${closedAt ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(stage, id).run()

    await c.env.DB.prepare(
      'INSERT INTO pipeline_history (id, lead_id, user_id, from_stage, to_stage, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), id, user.userId, lead.pipeline_stage, stage, reason || null).run()

    // Registrar atividade
    await c.env.DB.prepare(
      'INSERT INTO activities (id, lead_id, user_id, type, title, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), id, user.userId, 'pipeline_change', `Pipeline: ${lead.pipeline_stage} → ${stage}`, 'completed').run()

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Deletar lead (admin, director, manager)
leads.delete('/:id', requireRole('admin', 'director', 'manager'), async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM activities WHERE lead_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM proposals WHERE lead_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM pipeline_history WHERE lead_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Estatísticas do pipeline
leads.get('/stats/pipeline', async (c) => {
  const user = c.get('user')
  let whereClause = '1=1'
  const params: any[] = []

  if (user.role === 'broker') {
    whereClause = '(assigned_to = ? OR created_by = ?)'
    params.push(user.userId, user.userId)
  }

  const { results: byStage } = await c.env.DB.prepare(
    `SELECT pipeline_stage, COUNT(*) as count, SUM(estimated_value) as total_value FROM leads WHERE ${whereClause} AND status = 'active' GROUP BY pipeline_stage`
  ).bind(...params).all()

  const { results: byType } = await c.env.DB.prepare(
    `SELECT lead_type, COUNT(*) as count, SUM(estimated_value) as total_value FROM leads WHERE ${whereClause} GROUP BY lead_type`
  ).bind(...params).all()

  const summary = await c.env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN pipeline_stage='closed_won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN pipeline_stage='closed_lost' THEN 1 ELSE 0 END) as lost, SUM(CASE WHEN pipeline_stage='closed_won' THEN estimated_value ELSE 0 END) as revenue FROM leads WHERE ${whereClause}`
  ).bind(...params).first()

  return c.json({ byStage, byType, summary })
})

export default leads
