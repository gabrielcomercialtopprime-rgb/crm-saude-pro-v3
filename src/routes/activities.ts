// src/routes/activities.ts
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const activities = new Hono<{ Bindings: Bindings; Variables: Variables }>()
activities.use('*', requireAuth)

activities.get('/', async (c) => {
  const user = c.get('user')
  const { lead_id, type, status, limit = '20' } = c.req.query()

  let query = `SELECT a.*, u.name as user_name, l.name as lead_name FROM activities a 
    LEFT JOIN users u ON a.user_id = u.id 
    LEFT JOIN leads l ON a.lead_id = l.id WHERE 1=1`
  const params: any[] = []

  if (user.role === 'broker') { query += ' AND a.user_id = ?'; params.push(user.userId) }
  if (lead_id) { query += ' AND a.lead_id = ?'; params.push(lead_id) }
  if (type) { query += ' AND a.type = ?'; params.push(type) }
  if (status) { query += ' AND a.status = ?'; params.push(status) }

  query += ` ORDER BY a.created_at DESC LIMIT ${parseInt(limit)}`
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ activities: results })
})

activities.post('/', async (c) => {
  try {
    const user = c.get('user')
    const { lead_id, type, title, description, scheduled_at, outcome, duration_minutes } = await c.req.json()

    if (!lead_id || !type || !title) return c.json({ error: 'Campos obrigatórios faltando' }, 400)

    const id = 'act_' + generateId().replace(/-/g, '').substring(0, 12)
    await c.env.DB.prepare(
      'INSERT INTO activities (id, lead_id, user_id, type, title, description, scheduled_at, outcome, duration_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, lead_id, user.userId, type, title, description || null, scheduled_at || null, outcome || null, duration_minutes || null, 'completed').run()

    // Atualizar updated_at do lead
    await c.env.DB.prepare('UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(lead_id).run()

    return c.json({ success: true, id }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

activities.patch('/:id/complete', async (c) => {
  const { id } = c.req.param()
  const { outcome } = await c.req.json().catch(() => ({ outcome: null }))
  await c.env.DB.prepare(
    'UPDATE activities SET status = ?, outcome = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind('completed', outcome || null, id).run()
  return c.json({ success: true })
})

activities.delete('/:id', async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM activities WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default activities
