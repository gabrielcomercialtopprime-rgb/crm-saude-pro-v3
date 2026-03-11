// src/routes/reports.ts
import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware/auth'
import { generateId } from '../utils/auth'

type Bindings = { DB: D1Database; OPENAI_API_KEY: string }
type Variables = { user: any }

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>()
reports.use('*', requireAuth)

reports.get('/', async (c) => {
  const user = c.get('user')
  let query = 'SELECT * FROM reports WHERE 1=1'
  const params: any[] = []

  if (user.role === 'broker') { query += ' AND user_id = ?'; params.push(user.userId) }
  query += ' ORDER BY created_at DESC LIMIT 20'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ reports: results })
})

// Gerar relatório de performance
reports.post('/performance', async (c) => {
  try {
    const user = c.get('user')
    const { period_start, period_end, user_id } = await c.req.json()

    const targetUser = (user.role !== 'broker' && user_id) ? user_id : user.userId

    const start = period_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const end = period_end || new Date().toISOString().split('T')[0]

    // Coleta de dados
    const pipeline = await c.env.DB.prepare(`
      SELECT pipeline_stage, COUNT(*) as count, SUM(estimated_value) as total_value
      FROM leads WHERE (assigned_to = ? OR created_by = ?) 
      AND created_at BETWEEN ? AND ? GROUP BY pipeline_stage
    `).bind(targetUser, targetUser, start, end + ' 23:59:59').all()

    const activities = await c.env.DB.prepare(`
      SELECT type, COUNT(*) as count FROM activities 
      WHERE user_id = ? AND created_at BETWEEN ? AND ? GROUP BY type
    `).bind(targetUser, start, end + ' 23:59:59').all()

    const totals = await c.env.DB.prepare(`
      SELECT COUNT(*) as total_leads,
        SUM(CASE WHEN pipeline_stage='closed_won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN pipeline_stage='closed_lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN pipeline_stage='closed_won' THEN estimated_value ELSE 0 END) as revenue
      FROM leads WHERE (assigned_to = ? OR created_by = ?) AND created_at BETWEEN ? AND ?
    `).bind(targetUser, targetUser, start, end + ' 23:59:59').first() as any

    const byType = await c.env.DB.prepare(`
      SELECT lead_type, COUNT(*) as count FROM leads 
      WHERE (assigned_to = ? OR created_by = ?) AND created_at BETWEEN ? AND ? GROUP BY lead_type
    `).bind(targetUser, targetUser, start, end + ' 23:59:59').all()

    const reportData = {
      period: { start, end },
      totals,
      pipeline: pipeline.results,
      activities: activities.results,
      byType: byType.results
    }

    const id = 'rep_' + generateId().replace(/-/g, '').substring(0, 12)
    await c.env.DB.prepare(
      'INSERT INTO reports (id, user_id, type, title, data, period_start, period_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user.userId, 'performance', `Relatório de Performance - ${start} a ${end}`, JSON.stringify(reportData), start, end, 'generated').run()

    return c.json({ success: true, id, data: reportData })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Dashboard stats
reports.get('/dashboard', async (c) => {
  try {
    const user = c.get('user')
    const db = c.env.DB

    let leadWhere = '1=1'
    const params: any[] = []

    if (user.role === 'broker') {
      leadWhere = '(assigned_to = ? OR created_by = ?)'
      params.push(user.userId, user.userId)
    }

    // Total leads por estágio
    const { results: pipelineStats } = await db.prepare(
      `SELECT pipeline_stage, COUNT(*) as count, SUM(estimated_value) as value FROM leads WHERE ${leadWhere} GROUP BY pipeline_stage`
    ).bind(...params).all()

    // Total leads por tipo
    const { results: typeStats } = await db.prepare(
      `SELECT lead_type, COUNT(*) as count FROM leads WHERE ${leadWhere} GROUP BY lead_type`
    ).bind(...params).all()

    // Leads recentes
    const { results: recentLeads } = await db.prepare(
      `SELECT id, name, lead_type, pipeline_stage, estimated_value, created_at FROM leads WHERE ${leadWhere} ORDER BY created_at DESC LIMIT 5`
    ).bind(...params).all()

    // Tarefas pendentes do usuário
    const { results: pendingTasks } = await db.prepare(
      `SELECT * FROM tasks WHERE user_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 5`
    ).bind(user.userId).all()

    // Atividades recentes
    const { results: recentActivities } = await db.prepare(
      `SELECT a.*, l.name as lead_name FROM activities a LEFT JOIN leads l ON a.lead_id = l.id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 5`
    ).bind(user.userId).all()

    // Resumo geral
    const summary = await db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN pipeline_stage='closed_won' THEN 1 ELSE 0 END) as won, SUM(CASE WHEN pipeline_stage='closed_won' THEN estimated_value ELSE 0 END) as revenue FROM leads WHERE ${leadWhere}`
    ).bind(...params).first()

    // Leads criados este mês
    const thisMonth = await db.prepare(
      `SELECT COUNT(*) as count FROM leads WHERE ${leadWhere} AND created_at >= date('now','start of month')`
    ).bind(...params).first()

    // Notificações não lidas
    const unreadNotif = await db.prepare(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`
    ).bind(user.userId).first() as any

    return c.json({
      pipelineStats,
      typeStats,
      recentLeads,
      pendingTasks,
      recentActivities,
      summary,
      thisMonth,
      unreadNotifications: unreadNotif?.count || 0
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default reports
