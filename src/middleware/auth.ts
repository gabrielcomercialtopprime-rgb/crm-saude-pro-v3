// src/middleware/auth.ts
import { Context, Next } from 'hono'
import { getAuthUser, JWTPayload } from '../utils/auth'

export async function requireAuth(c: Context, next: Next) {
  const user = await getAuthUser(c)
  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401)
  }
  c.set('user', user)
  await next()
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as JWTPayload
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Acesso negado' }, 403)
    }
    await next()
  }
}
