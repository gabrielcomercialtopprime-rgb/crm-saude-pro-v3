// src/routes/users.ts
import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import { hashPassword, generateId } from '../utils/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }
type Variables = { user: any }

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

users.use('*', requireAuth)

// Listar usuários (admin, director, manager)
users.get('/', requireRole('admin', 'director', 'manager'), async (c) => {
  const { role, search, active } = c.req.query()
  let query = 'SELECT id, name, email, role, phone, active, created_at, last_login FROM users WHERE 1=1'
  const params: any[] = []

  if (role) { query += ' AND role = ?'; params.push(role) }
  if (search) { query += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (active !== undefined) { query += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
  query += ' ORDER BY created_at DESC'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ users: results })
})

// Criar usuário (admin only)
users.post('/', requireRole('admin'), async (c) => {
  try {
    const { name, email, password, role, phone } = await c.req.json()
    if (!name || !email || !password || !role) return c.json({ error: 'Campos obrigatórios faltando' }, 400)

    const roles = ['admin', 'director', 'manager', 'broker']
    if (!roles.includes(role)) return c.json({ error: 'Role inválida' }, 400)

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
    if (existing) return c.json({ error: 'Email já cadastrado' }, 409)

    const id = 'usr_' + generateId().replace(/-/g, '').substring(0, 12)
    const hash = await hashPassword(password)
    const currentUser = c.get('user')

    await c.env.DB.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, phone, active, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).bind(id, name, email.toLowerCase(), hash, role, phone || null, currentUser.userId).run()

    return c.json({ success: true, id }, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Buscar usuário por ID
users.get('/:id', requireRole('admin', 'director', 'manager'), async (c) => {
  const { id } = c.req.param()
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, phone, active, created_at, last_login FROM users WHERE id = ?'
  ).bind(id).first()
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})

// Atualizar usuário (admin)
users.put('/:id', requireRole('admin'), async (c) => {
  try {
    const { id } = c.req.param()
    const { name, email, role, phone, active, password } = await c.req.json()

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    let query = 'UPDATE users SET name = ?, email = ?, role = ?, phone = ?, active = ?, updated_at = CURRENT_TIMESTAMP'
    const params: any[] = [name, email.toLowerCase(), role, phone || null, active ? 1 : 0]

    if (password) {
      const hash = await hashPassword(password)
      query += ', password_hash = ?'
      params.push(hash)
    }

    query += ' WHERE id = ?'
    params.push(id)

    await c.env.DB.prepare(query).bind(...params).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Ativar/Desativar usuário (admin)
users.patch('/:id/toggle', requireRole('admin'), async (c) => {
  const { id } = c.req.param()
  const currentUser = c.get('user')
  if (id === currentUser.userId) return c.json({ error: 'Não pode desativar a si mesmo' }, 400)

  const user = await c.env.DB.prepare('SELECT active FROM users WHERE id = ?').bind(id).first() as any
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

  await c.env.DB.prepare('UPDATE users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(user.active ? 0 : 1, id).run()

  return c.json({ success: true, active: !user.active })
})

// Deletar usuário (admin)
users.delete('/:id', requireRole('admin'), async (c) => {
  const { id } = c.req.param()
  const currentUser = c.get('user')
  if (id === currentUser.userId) return c.json({ error: 'Não pode deletar a si mesmo' }, 400)

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default users
