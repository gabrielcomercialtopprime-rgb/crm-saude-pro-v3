// src/routes/auth.ts
import { Hono } from 'hono'
import { createToken, verifyPassword, hashPassword, generateId, getAuthUser } from '../utils/auth'

type Bindings = { DB: D1Database; JWT_SECRET: string }

const auth = new Hono<{ Bindings: Bindings }>()

auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email e senha obrigatórios' }, 400)

    const db = c.env.DB
    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').bind(email.toLowerCase().trim()).first() as any

    if (!user) return c.json({ error: 'Credenciais inválidas' }, 401)

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) return c.json({ error: 'Credenciais inválidas' }, 401)

    await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()

    const token = await createToken(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      c.env.JWT_SECRET || 'crm-saude-pro-secret-2024'
    )

    return c.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme, avatar: user.avatar }
    })
  } catch (e: any) {
    return c.json({ error: 'Erro no servidor: ' + e.message }, 500)
  }
})

auth.get('/me', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Não autorizado' }, 401)

  const db = c.env.DB
  const user = await db.prepare('SELECT id, name, email, role, theme, avatar, phone, last_login FROM users WHERE id = ?').bind(authUser.userId).first() as any
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

  return c.json({ user })
})

auth.put('/theme', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Não autorizado' }, 401)

  const { theme } = await c.req.json()
  await c.env.DB.prepare('UPDATE users SET theme = ? WHERE id = ?').bind(theme, authUser.userId).run()
  return c.json({ success: true })
})

auth.put('/profile', async (c) => {
  const authUser = await getAuthUser(c)
  if (!authUser) return c.json({ error: 'Não autorizado' }, 401)

  const { name, phone, currentPassword, newPassword } = await c.req.json()
  const db = c.env.DB

  if (newPassword) {
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(authUser.userId).first() as any
    const valid = await verifyPassword(currentPassword, user.password_hash)
    if (!valid) return c.json({ error: 'Senha atual incorreta' }, 400)
    const newHash = await hashPassword(newPassword)
    await db.prepare('UPDATE users SET name = ?, phone = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(name, phone, newHash, authUser.userId).run()
  } else {
    await db.prepare('UPDATE users SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(name, phone, authUser.userId).run()
  }

  return c.json({ success: true })
})

export default auth
