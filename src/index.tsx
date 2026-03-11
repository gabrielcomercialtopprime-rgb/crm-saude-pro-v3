// src/index.tsx - CRM Saúde PRO - Backend Principal
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import leadsRoutes from './routes/leads'
import activitiesRoutes from './routes/activities'
import tasksRoutes from './routes/tasks'
import proposalsRoutes from './routes/proposals'
import reportsRoutes from './routes/reports'
import aiRoutes from './routes/ai'
import notificationsRoutes from './routes/notifications'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OPENAI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// API Routes
app.route('/api/auth', authRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/leads', leadsRoutes)
app.route('/api/activities', activitiesRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/proposals', proposalsRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/notifications', notificationsRoutes)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', app: 'CRM Saúde PRO', version: '1.0.0' }))

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// SPA fallback - serve index.html for all non-API routes
app.get('*', async (c) => {
  const path = c.req.path
  if (path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404)
  
  return c.html(getIndexHTML())
})

function getIndexHTML(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM Saúde PRO</title>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="/static/app.js"></script>
  <script src="/static/pages.js"></script>
  <script src="/static/pages2.js"></script>
</body>
</html>`
}

export default app
