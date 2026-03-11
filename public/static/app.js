// CRM Saúde PRO - Frontend Principal
// =====================================================
// ESTADO GLOBAL
// =====================================================
const CRM = {
  token: localStorage.getItem('crm_token'),
  user: JSON.parse(localStorage.getItem('crm_user') || 'null'),
  currentPage: 'dashboard',
  sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === 'true',
  aiSessionId: null,
  charts: {},
  
  api: async function(method, path, data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (data) opts.body = JSON.stringify(data);
    
    const res = await fetch(`/api${path}`, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Erro na requisição');
    return json;
  },
  
  get: function(path) { return this.api('GET', path); },
  post: function(path, data) { return this.api('POST', path, data); },
  put: function(path, data) { return this.api('PUT', path, data); },
  patch: function(path, data) { return this.api('PATCH', path, data); },
  delete: function(path) { return this.api('DELETE', path); },
  
  can: function(roles) {
    if (!this.user) return false;
    if (!Array.isArray(roles)) roles = [roles];
    return roles.includes(this.user.role);
  },
  
  roleLabel: function(role) {
    const labels = { admin: 'Administrador', director: 'Diretor', manager: 'Gerente', broker: 'Corretor' };
    return labels[role] || role;
  },
  
  formatMoney: function(v) {
    if (!v && v !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  },
  
  formatDate: function(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  },
  
  formatDateTime: function(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('pt-BR');
  },
  
  timeAgo: function(d) {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  },
  
  getGreeting: function() {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Bom dia', icon: '🌅' };
    if (h < 18) return { text: 'Boa tarde', icon: '☀️' };
    return { text: 'Boa noite', icon: '🌙' };
  },
  
  stageLabels: {
    new_lead: 'Novo Lead', first_contact: '1º Contato',
    qualification: 'Qualificação', proposal: 'Proposta',
    negotiation: 'Negociação', closed_won: 'Fechado/Ganho', closed_lost: 'Fechado/Perdido'
  },
  
  typeLabels: { pf: 'Pessoa Física', pme: 'PME', adhesion: 'Adesão' },
  
  stageColors: {
    new_lead: '#64748b', first_contact: '#3b82f6', qualification: '#8b5cf6',
    proposal: '#f59e0b', negotiation: '#f97316', closed_won: '#10b981', closed_lost: '#ef4444'
  }
};

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================
function toast(message, type = 'info', duration = 4000) {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(el);
  setTimeout(() => el.style.animation = 'toast-in 0.3s ease reverse', duration - 300);
  setTimeout(() => el.remove(), duration);
}

// =====================================================
// MODAL SYSTEM
// =====================================================
function showModal(title, bodyHTML, footer = '', size = '600px') {
  let overlay = document.getElementById('global-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-modal';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="modal" style="max-width:${size}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('open'), 10);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

function closeModal() {
  const overlay = document.getElementById('global-modal');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.style.display = 'none', 200);
  }
}

// =====================================================
// CONFIRM DIALOG
// =====================================================
function confirm(msg, cb) {
  showModal('Confirmar Ação',
    `<div style="text-align:center;padding:12px 0"><i class="fas fa-exclamation-triangle" style="font-size:40px;color:#f59e0b;display:block;margin-bottom:12px"></i><p style="font-size:14px;color:var(--text)">${msg}</p></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="closeModal();(${cb.toString()})()">Confirmar</button>`
  );
}

// =====================================================
// SIDEBAR
// =====================================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  
  if (CRM.sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('sidebar-collapsed');
  }
  
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    CRM.sidebarCollapsed = !CRM.sidebarCollapsed;
    localStorage.setItem('sidebar_collapsed', CRM.sidebarCollapsed);
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-collapsed');
  });
}

function getNavItems() {
  const items = [
    { section: 'Principal' },
    { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard', roles: ['admin','director','manager','broker'] },
    { id: 'pipeline', icon: 'fa-filter', label: 'Pipeline', roles: ['admin','director','manager','broker'] },
    { id: 'leads', icon: 'fa-users', label: 'Leads', roles: ['admin','director','manager','broker'] },
    { section: 'Comercial' },
    { id: 'activities', icon: 'fa-phone-alt', label: 'Atividades', roles: ['admin','director','manager','broker'] },
    { id: 'tasks', icon: 'fa-tasks', label: 'Tarefas', roles: ['admin','director','manager','broker'] },
    { id: 'proposals', icon: 'fa-file-contract', label: 'Propostas', roles: ['admin','director','manager','broker'] },
    { section: 'Análise' },
    { id: 'reports', icon: 'fa-chart-bar', label: 'Relatórios', roles: ['admin','director','manager','broker'] },
    { id: 'ai', icon: 'fa-robot', label: 'IA Assistente', roles: ['admin','director','manager','broker'] },
    { section: 'Administração' },
    { id: 'users', icon: 'fa-user-shield', label: 'Usuários', roles: ['admin','director','manager'] },
    { id: 'settings', icon: 'fa-cog', label: 'Configurações', roles: ['admin','director','manager','broker'] },
  ];
  return items;
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  let html = '';
  
  getNavItems().forEach(item => {
    if (item.section) {
      html += `<div class="nav-section-title">${item.section}</div>`;
      return;
    }
    if (!CRM.can(item.roles)) return;
    
    html += `<div class="nav-item${CRM.currentPage === item.id ? ' active' : ''}" 
      onclick="navigateTo('${item.id}')" 
      data-tooltip="${item.label}"
      id="nav-${item.id}">
      <i class="fas ${item.icon}"></i>
      <span class="nav-item-label">${item.label}</span>
      ${item.id === 'ai' ? '<span class="nav-badge">IA</span>' : ''}
    </div>`;
  });
  
  nav.innerHTML = html;
}

// =====================================================
// TOPBAR
// =====================================================
function renderTopbar() {
  const greeting = CRM.getGreeting();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  
  document.getElementById('topbar-greeting').innerHTML = `
    <h2>${greeting.icon} ${greeting.text}, ${CRM.user.name.split(' ')[0]}!</h2>
    <p id="topbar-datetime">${timeStr} • ${dateStr}</p>`;
  
  document.getElementById('user-display-name').textContent = CRM.user.name;
  document.getElementById('user-display-role').textContent = CRM.roleLabel(CRM.user.role);
  
  const initials = CRM.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-text').textContent = initials;
  
  // Atualizar relógio
  setInterval(() => {
    const n = new Date();
    const el = document.getElementById('topbar-datetime');
    if (el) el.textContent = `${n.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • ${n.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;
  }, 30000);
  
  // Carregar notificações
  loadNotifications();
}

// =====================================================
// NAVEGAÇÃO
// =====================================================
function navigateTo(page) {
  CRM.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');
  
  document.getElementById('page-content').innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Carregando...</span></div>';
  
  const pages = {
    dashboard: renderDashboard,
    pipeline: renderPipeline,
    leads: renderLeads,
    activities: renderActivities,
    tasks: renderTasks,
    proposals: renderProposals,
    reports: renderReports,
    ai: renderAI,
    users: renderUsers,
    settings: renderSettings
  };
  
  const fn = pages[page];
  if (fn) fn();
}

// =====================================================
// AUTH - LOGIN PAGE
// =====================================================
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div id="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon"><i class="fas fa-heartbeat"></i></div>
          <div>
            <h1>CRM Saúde <span>PRO</span></h1>
            <div class="login-subtitle">Plataforma de Gestão Comercial</div>
          </div>
        </div>
        
        <form id="login-form">
          <div class="login-form-group">
            <label class="login-label">E-mail</label>
            <div class="login-input-wrapper">
              <i class="fas fa-envelope login-input-icon"></i>
              <input type="email" class="login-input" id="login-email" placeholder="seu@email.com" required autocomplete="email">
            </div>
          </div>
          <div class="login-form-group">
            <label class="login-label">Senha</label>
            <div class="login-input-wrapper">
              <i class="fas fa-lock login-input-icon"></i>
              <input type="password" class="login-input" id="login-password" placeholder="••••••••" required autocomplete="current-password">
              <i class="fas fa-eye" id="pwd-toggle" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4);cursor:pointer" onclick="togglePwd()"></i>
            </div>
          </div>
          <button type="submit" class="login-btn" id="login-btn">
            <span id="login-btn-text">Entrar no Sistema</span>
            <i class="fas fa-arrow-right" id="login-btn-icon"></i>
          </button>
          <div class="login-error" id="login-error"></div>
        </form>
        
        <div class="login-footer">
          <i class="fas fa-shield-alt"></i> CRM Saúde PRO v1.0 • Acesso Seguro
        </div>
      </div>
    </div>`;
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    document.getElementById('login-btn-text').textContent = 'Entrando...';
    document.getElementById('login-btn-icon').className = 'loading-spinner';
    
    try {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const data = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(r => r.json());
      
      if (!data.token) throw new Error(data.error || 'Credenciais inválidas');
      
      CRM.token = data.token;
      CRM.user = data.user;
      localStorage.setItem('crm_token', data.token);
      localStorage.setItem('crm_user', JSON.stringify(data.user));
      
      // Aplicar tema salvo
      if (data.user.theme) {
        document.documentElement.setAttribute('data-theme', data.user.theme);
      }
      
      renderApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('login-btn-text').textContent = 'Entrar no Sistema';
      document.getElementById('login-btn-icon').className = 'fas fa-arrow-right';
    }
  });
}

function togglePwd() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('pwd-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
    icon.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.6);cursor:pointer';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
    icon.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4);cursor:pointer';
  }
}

function logout() {
  CRM.token = null;
  CRM.user = null;
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
  renderLogin();
}

// =====================================================
// APP PRINCIPAL
// =====================================================
function renderApp() {
  const theme = CRM.user?.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  
  document.getElementById('app').innerHTML = `
    <div id="app-layout">
      <!-- SIDEBAR -->
      <nav id="sidebar" class="${CRM.sidebarCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header">
          <div class="sidebar-logo-icon"><i class="fas fa-heartbeat"></i></div>
          <div class="sidebar-title">CRM Saúde<span>PRO • ${CRM.roleLabel(CRM.user.role)}</span></div>
          <button id="sidebar-toggle" title="Recolher menu"><i class="fas fa-bars"></i></button>
        </div>
        <div class="sidebar-nav" id="sidebar-nav"></div>
        <div class="sidebar-footer">
          <div class="nav-item" onclick="logout()" data-tooltip="Sair">
            <i class="fas fa-sign-out-alt" style="color:#ef4444"></i>
            <span class="nav-item-label" style="color:#ef4444">Sair</span>
          </div>
        </div>
      </nav>
      
      <!-- MAIN CONTENT -->
      <div id="main-content" class="${CRM.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
        <!-- TOPBAR -->
        <header id="topbar">
          <div id="topbar-greeting" class="topbar-greeting"></div>
          <div class="topbar-actions">
            <button class="topbar-btn" onclick="navigateTo('tasks')" title="Tarefas"><i class="fas fa-tasks"></i></button>
            <div class="dropdown">
              <button class="topbar-btn" id="notif-btn" onclick="toggleNotifications()" title="Notificações">
                <i class="fas fa-bell"></i>
                <span class="topbar-notif-badge" id="notif-badge" style="display:none">0</span>
              </button>
              <div class="dropdown-menu" id="notif-dropdown" style="display:none;min-width:320px" onclick="event.stopPropagation()">
                <div style="padding:12px 16px;font-weight:600;font-size:13px;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between">
                  Notificações
                  <button class="btn btn-sm btn-secondary" onclick="markAllRead()">Marcar todas</button>
                </div>
                <div id="notif-list" style="max-height:300px;overflow-y:auto"></div>
              </div>
            </div>
            <button class="topbar-btn" onclick="toggleTheme()" title="Alternar tema" id="theme-btn">
              <i class="fas fa-moon"></i>
            </button>
            <div class="dropdown user-menu" onclick="toggleUserMenu()">
              <div class="user-avatar" id="user-avatar-text">--</div>
              <div>
                <div class="user-name" id="user-display-name">Usuário</div>
                <div class="user-role" id="user-display-role">Cargo</div>
              </div>
              <i class="fas fa-chevron-down" style="font-size:11px;margin-left:4px;color:var(--text-secondary)"></i>
              <div class="dropdown-menu" id="user-dropdown" style="display:none" onclick="event.stopPropagation()">
                <div class="dropdown-item" onclick="closeDropdowns();navigateTo('settings')">
                  <i class="fas fa-user"></i> Meu Perfil
                </div>
                <div class="dropdown-item" onclick="closeDropdowns();navigateTo('settings')">
                  <i class="fas fa-cog"></i> Configurações
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item danger" onclick="logout()">
                  <i class="fas fa-sign-out-alt"></i> Sair
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <!-- PAGE CONTENT -->
        <main id="page-content"></main>
      </div>
    </div>
    <div id="toast-container"></div>`;
  
  initSidebar();
  renderSidebar();
  renderTopbar();
  navigateTo('dashboard');
  updateThemeBtn();
  
  // Fechar dropdowns ao clicar fora
  document.addEventListener('click', () => closeDropdowns());
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  CRM.user.theme = next;
  localStorage.setItem('crm_user', JSON.stringify(CRM.user));
  CRM.patch('/auth/theme', { theme: next }).catch(() => {});
  updateThemeBtn();
}

function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const theme = document.documentElement.getAttribute('data-theme');
  btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  btn.title = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
}

function toggleUserMenu() {
  event.stopPropagation();
  document.getElementById('notif-dropdown').style.display = 'none';
  const dd = document.getElementById('user-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function toggleNotifications() {
  event.stopPropagation();
  document.getElementById('user-dropdown').style.display = 'none';
  const dd = document.getElementById('notif-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function closeDropdowns() {
  const dd1 = document.getElementById('notif-dropdown');
  const dd2 = document.getElementById('user-dropdown');
  if (dd1) dd1.style.display = 'none';
  if (dd2) dd2.style.display = 'none';
}

async function loadNotifications() {
  try {
    const data = await CRM.get('/notifications?unread=true');
    const badge = document.getElementById('notif-badge');
    const count = data.notifications?.length || 0;
    if (badge) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (count === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fas fa-bell" style="font-size:24px"></i><p>Nenhuma notificação</p></div>';
      return;
    }
    
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', lead: 'fa-user-plus', task: 'fa-tasks' };
    list.innerHTML = data.notifications.map(n => `
      <div class="dropdown-item" onclick="markNotifRead('${n.id}')">
        <i class="fas ${icons[n.type] || 'fa-bell'}" style="color:var(--accent)"></i>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${n.title}</div>
          <div style="font-size:11px;color:var(--text-secondary)">${n.message}</div>
          <div style="font-size:10px;color:var(--text-muted)">${CRM.timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (e) {}
}

async function markNotifRead(id) {
  await CRM.patch(`/notifications/${id}/read`, {}).catch(() => {});
  loadNotifications();
}

async function markAllRead() {
  await CRM.patch('/notifications/read-all', {}).catch(() => {});
  loadNotifications();
  closeDropdowns();
}

// =====================================================
// DASHBOARD
// =====================================================
async function renderDashboard() {
  const content = document.getElementById('page-content');
  const greeting = CRM.getGreeting();
  
  try {
    const data = await CRM.get('/reports/dashboard');
    
    const pipelineMap = {};
    (data.pipelineStats || []).forEach(s => { pipelineMap[s.pipeline_stage] = s; });
    
    const typeMap = {};
    (data.typeStats || []).forEach(s => { typeMap[s.lead_type] = s; });
    
    const total = data.summary?.total_leads || 0;
    const won = data.summary?.won || 0;
    const revenue = data.summary?.revenue || 0;
    const convRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;
    
    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${greeting.icon} ${greeting.text}, ${CRM.user.name.split(' ')[0]}!</h1>
          <p class="page-subtitle">Aqui está um resumo da sua operação hoje</p>
        </div>
        <button class="btn btn-primary" onclick="navigateTo('leads');showAddLeadModal()">
          <i class="fas fa-plus"></i> Novo Lead
        </button>
      </div>
      
      <!-- STAT CARDS -->
      <div class="grid-4" style="margin-bottom:24px">
        <div class="stat-card blue hoverable">
          <div class="stat-icon blue"><i class="fas fa-users"></i></div>
          <div class="stat-label">Total de Leads</div>
          <div class="stat-value">${total}</div>
          <div class="stat-change up"><i class="fas fa-arrow-up"></i> ${data.thisMonth?.count || 0} este mês</div>
        </div>
        <div class="stat-card green hoverable">
          <div class="stat-icon green"><i class="fas fa-trophy"></i></div>
          <div class="stat-label">Fechados/Ganhos</div>
          <div class="stat-value">${won}</div>
          <div class="stat-change up"><i class="fas fa-percentage"></i> ${convRate}% conversão</div>
        </div>
        <div class="stat-card orange hoverable">
          <div class="stat-icon orange"><i class="fas fa-dollar-sign"></i></div>
          <div class="stat-label">Receita Total</div>
          <div class="stat-value" style="font-size:20px">${CRM.formatMoney(revenue)}</div>
          <div class="stat-change up"><i class="fas fa-chart-line"></i> Acumulado</div>
        </div>
        <div class="stat-card purple hoverable">
          <div class="stat-icon purple"><i class="fas fa-tasks"></i></div>
          <div class="stat-label">Tarefas Pendentes</div>
          <div class="stat-value">${data.pendingTasks?.length || 0}</div>
          <div class="stat-change"><i class="fas fa-clock"></i> Para completar</div>
        </div>
      </div>
      
      <!-- FUNIL POR TIPO -->
      <div class="grid-3" style="margin-bottom:24px">
        ${['pf','pme','adhesion'].map(t => {
          const info = typeMap[t] || { count: 0, total_value: 0 };
          const icons = { pf: 'fa-user', pme: 'fa-building', adhesion: 'fa-id-card' };
          const labels = { pf: 'Pessoa Física', pme: 'PME', adhesion: 'Adesão' };
          const colors = { pf: 'blue', pme: 'purple', adhesion: 'green' };
          return `
          <div class="card hoverable" style="cursor:pointer" onclick="navigateTo('leads');filterLeadType('${t}')">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div class="stat-icon ${colors[t]}"><i class="fas ${icons[t]}"></i></div>
              <div><div class="card-title">${labels[t]}</div><div class="card-subtitle">Funil de vendas</div></div>
            </div>
            <div class="stat-value" style="font-size:24px">${info.count}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${CRM.formatMoney(info.total_value)}</div>
          </div>`;
        }).join('')}
      </div>
      
      <!-- PIPELINE + TAREFAS -->
      <div class="grid-2" style="margin-bottom:24px">
        <div class="card">
          <div class="card-header">
            <div><div class="card-title"><i class="fas fa-filter" style="color:var(--accent);margin-right:8px"></i>Pipeline de Vendas</div></div>
            <button class="btn btn-sm btn-secondary" onclick="navigateTo('pipeline')">Ver completo</button>
          </div>
          <div id="pipeline-mini-chart" style="height:200px">
            <canvas id="pipelineChart"></canvas>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <div><div class="card-title"><i class="fas fa-tasks" style="color:var(--accent);margin-right:8px"></i>Próximas Tarefas</div></div>
            <button class="btn btn-sm btn-primary" onclick="navigateTo('tasks');showAddTaskModal()">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          ${(data.pendingTasks || []).length === 0 ? 
            '<div class="empty-state"><i class="fas fa-check-circle"></i><p>Sem tarefas pendentes</p></div>' :
            (data.pendingTasks || []).map(t => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--card-border)">
                <div class="stat-icon ${t.priority==='high'?'red':t.priority==='medium'?'orange':'green'}" style="width:32px;height:32px;font-size:12px">
                  <i class="fas fa-${t.type==='call'?'phone':'tasks'}"></i>
                </div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:500">${t.title}</div>
                  <div style="font-size:11px;color:var(--text-secondary)">${CRM.formatDateTime(t.due_date)}</div>
                </div>
                <button class="btn btn-sm btn-success" onclick="completeTask('${t.id}',this)">
                  <i class="fas fa-check"></i>
                </button>
              </div>`).join('')
          }
        </div>
      </div>
      
      <!-- LEADS RECENTES + ATIVIDADES -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div><div class="card-title"><i class="fas fa-user-plus" style="color:var(--accent);margin-right:8px"></i>Leads Recentes</div></div>
            <button class="btn btn-sm btn-secondary" onclick="navigateTo('leads')">Ver todos</button>
          </div>
          ${(data.recentLeads || []).length === 0 ?
            '<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum lead ainda</p></div>' :
            (data.recentLeads || []).map(l => `
              <div class="hoverable" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--card-border);cursor:pointer" onclick="openLeadDetail('${l.id}')">
                <div class="user-avatar" style="width:36px;height:36px;font-size:13px">${l.name[0].toUpperCase()}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:500">${l.name}</div>
                  <div style="font-size:11px;color:var(--text-secondary)">
                    <span class="pipeline-card-type type-${l.lead_type}">${CRM.typeLabels[l.lead_type]}</span>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:12px;font-weight:600;color:var(--accent)">${CRM.formatMoney(l.estimated_value)}</div>
                  <div style="font-size:10px;color:var(--text-secondary)">${CRM.stageLabels[l.pipeline_stage]}</div>
                </div>
              </div>`).join('')
          }
        </div>
        
        <div class="card">
          <div class="card-header">
            <div><div class="card-title"><i class="fas fa-history" style="color:var(--accent);margin-right:8px"></i>Atividades Recentes</div></div>
            <button class="btn btn-sm btn-secondary" onclick="navigateTo('activities')">Ver todas</button>
          </div>
          ${(data.recentActivities || []).length === 0 ?
            '<div class="empty-state"><i class="fas fa-phone-alt"></i><p>Nenhuma atividade ainda</p></div>' :
            (data.recentActivities || []).map(a => {
              const actIcons = { call: 'fa-phone', email: 'fa-envelope', meeting: 'fa-calendar', whatsapp: 'fa-whatsapp', pipeline_change: 'fa-exchange-alt', note: 'fa-sticky-note', proposal: 'fa-file-contract', follow_up: 'fa-redo' };
              return `
              <div class="activity-item">
                <div class="activity-icon ${a.type}"><i class="fas ${actIcons[a.type] || 'fa-circle'}"></i></div>
                <div class="activity-content">
                  <div class="activity-title">${a.title}</div>
                  ${a.lead_name ? `<div style="font-size:11px;color:var(--accent)">${a.lead_name}</div>` : ''}
                  <div class="activity-time">${CRM.timeAgo(a.created_at)}</div>
                </div>
              </div>`;
            }).join('')
          }
        </div>
      </div>`;
    
    // Renderizar gráfico de pipeline
    renderPipelineChart(data.pipelineStats || []);
    
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i><h3>Erro ao carregar dashboard</h3><p>${e.message}</p><button class="btn btn-primary" onclick="renderDashboard()">Tentar novamente</button></div></div>`;
  }
}

function renderPipelineChart(stats) {
  const canvas = document.getElementById('pipelineChart');
  if (!canvas) return;
  
  if (CRM.charts.pipeline) CRM.charts.pipeline.destroy();
  
  const stages = Object.keys(CRM.stageLabels);
  const counts = stages.map(s => { const f = stats.find(x => x.pipeline_stage === s); return f ? f.count : 0; });
  const colors = stages.map(s => CRM.stageColors[s]);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  
  CRM.charts.pipeline = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: stages.map(s => CRM.stageLabels[s]),
      datasets: [{ data: counts, backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }
      }
    }
  });
}

<body>
  <!-- seu conteúdo -->
  <button id="menu-toggle">☰</button>
  <div id="sidebar"> ... </div>

  <script>
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("menu-toggle");

    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });

    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove("mobile-open");
      }
    });
  </script>
</body>

