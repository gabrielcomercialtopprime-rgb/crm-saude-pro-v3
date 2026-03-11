// src/routes/proposals.ts
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const proposals = new Hono<{ Bindings: Bindings; Variables: Variables }>()
proposals.use('*', requireAuth)

proposals.get('/', async (c) => {
  const user = c.get('user')
  const { lead_id, status } = c.req.query()

  let query = `SELECT p.*, l.name as lead_name, u.name as user_name FROM proposals p 
    LEFT JOIN leads l ON p.lead_id = l.id 
    LEFT JOIN users u ON p.user_id = u.id WHERE 1=1`
  const params: any[] = []

  if (user.role === 'broker') { query += ' AND p.user_id = ?'; params.push(user.userId) }
  if (lead_id) { query += ' AND p.lead_id = ?'; params.push(lead_id) }
  if (status) { query += ' AND p.status = ?'; params.push(status) }

  query += ' ORDER BY p.created_at DESC LIMIT 50'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ proposals: results })
})

proposals.post('/', async (c) => {
  try {
    const user = c.get('user')
    const { lead_id, title, operator, plan_name, plan_type, monthly_value, lives_count, validity_date, notes } = await c.req.json()

    if (!lead_id || !title || !operator || !plan_name || !monthly_value) {
      return c.json({ error: 'Campos obrigatórios faltando' }, 400)
    }

    const id = 'prop_' + generateId().replace(/-/g, '').substring(0, 12)
    await c.env.DB.prepare(
      'INSERT INTO proposals (id, lead_id, user_id, title, operator, plan_name, plan_type, monthly_value, lives_count, validity_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, lead_id, user.userId, title, operator, plan_name, plan_type || 'individual', monthly_value, lives_count || 1, validity_date || null, notes || null).run()

    // Criar atividade
    const lead = await c.env.DB.prepare('SELECT name FROM leads WHERE id = ?').bind(lead_id).first() as any
    await c.env.DB.prepare(
      'INSERT INTO activities (id, lead_id, user_id, type, title, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(generateId(), lead_id, user.userId, 'proposal', `Proposta enviada: ${title} - R$${monthly_value}/mês`, 'completed').run()

    return c.json({ success: true, id }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

proposals.patch('/:id/status', async (c) => {
  const { id } = c.req.param()
  const { status } = await c.req.json()
  const validStatus = ['draft', 'sent', 'accepted', 'rejected', 'expired']
  if (!validStatus.includes(status)) return c.json({ error: 'Status inválido' }, 400)

  await c.env.DB.prepare('UPDATE proposals SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  return c.json({ success: true })
})

proposals.delete('/:id', async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM proposals WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default proposals
