// src/routes/tasks.ts
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const tasks = new Hono<{ Bindings: Bindings; Variables: Variables }>()
tasks.use('*', requireAuth)

tasks.get('/', async (c) => {
  const user = c.get('user')
  const { status, priority, type, upcoming } = c.req.query()

  let query = `SELECT t.*, l.name as lead_name FROM tasks t LEFT JOIN leads l ON t.lead_id = l.id WHERE 1=1`
  const params: any[] = []

  if (user.role === 'broker') { query += ' AND t.user_id = ?'; params.push(user.userId) }
  if (status) { query += ' AND t.status = ?'; params.push(status) }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority) }
  if (type) { query += ' AND t.type = ?'; params.push(type) }
  if (upcoming === 'true') {
    query += ' AND t.due_date >= datetime("now") AND t.status = "pending"'
  }

  query += ' ORDER BY t.due_date ASC LIMIT 50'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ tasks: results })
})

tasks.post('/', async (c) => {
  try {
    const user = c.get('user')
    const { title, description, due_date, priority, type, lead_id, reminder_at } = await c.req.json()

    if (!title || !due_date) return c.json({ error: 'Título e data são obrigatórios' }, 400)

    const id = 'task_' + generateId().replace(/-/g, '').substring(0, 12)
    await c.env.DB.prepare(
      'INSERT INTO tasks (id, user_id, lead_id, title, description, due_date, priority, type, reminder_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user.userId, lead_id || null, title, description || null, due_date, priority || 'medium', type || 'task', reminder_at || null).run()

    return c.json({ success: true, id }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

tasks.put('/:id', async (c) => {
  const { id } = c.req.param()
  const { title, description, due_date, priority, type, status } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE tasks SET title=?, description=?, due_date=?, priority=?, type=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(title, description || null, due_date, priority, type, status, id).run()
  return c.json({ success: true })
})

tasks.patch('/:id/complete', async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare(
    'UPDATE tasks SET status="completed", completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(id).run()
  return c.json({ success: true })
})

tasks.delete('/:id', async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

export default tasks
