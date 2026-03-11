// src/routes/notifications.ts
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

type Bindings = { DB: D1Database }
type Variables = { user: any }

const notifications = new Hono<{ Bindings: Bindings; Variables: Variables }>()
notifications.use('*', requireAuth)

notifications.get('/', async (c) => {
  const user = c.get('user')
  const { unread } = c.req.query()

  let query = 'SELECT * FROM notifications WHERE user_id = ?'
  const params: any[] = [user.userId]

  if (unread === 'true') { query += ' AND read = 0' }
  query += ' ORDER BY created_at DESC LIMIT 20'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ notifications: results })
})

notifications.patch('/:id/read', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, user.userId).run()
  return c.json({ success: true })
})

notifications.patch('/read-all', async (c) => {
  const user = c.get('user')
  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(user.userId).run()
  return c.json({ success: true })
})

notifications.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  await c.env.DB.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').bind(id, user.userId).run()
  return c.json({ success: true })
})

export default notifications
