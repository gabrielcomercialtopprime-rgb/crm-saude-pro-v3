// CRM Saúde PRO - Relatórios, IA, Usuários e Configurações

// =====================================================
// RELATÓRIOS
// =====================================================
async function renderReports() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Relatórios</h1>
        <p class="page-subtitle">Análise de performance e resultados</p></div>
    </div>
    
    <!-- GERAR RELATÓRIO -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title"><i class="fas fa-magic" style="color:var(--accent)"></i> Gerar Novo Relatório</div></div>
      <div class="grid-3" style="margin-bottom:16px">
        <div class="form-group">
          <label class="form-label">Data Início</label>
          <input type="date" class="form-control" id="rep-start" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Data Fim</label>
          <input type="date" class="form-control" id="rep-end" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px;padding-bottom:16px">
          <button class="btn btn-primary" style="flex:1" onclick="generatePerformanceReport()">
            <i class="fas fa-chart-line"></i> Gerar Relatório
          </button>
          ${CRM.can(['admin','director','manager']) ? `
          <button class="btn btn-secondary" style="flex:1" onclick="generateAIReport()">
            <i class="fas fa-robot"></i> Com IA
          </button>` : ''}
        </div>
      </div>
    </div>
    
    <div id="report-result"></div>
    
    <!-- HISTÓRICO -->
    <div class="card">
      <div class="card-header"><div class="card-title"><i class="fas fa-history" style="color:var(--accent)"></i> Relatórios Anteriores</div></div>
      <div id="reports-history">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>
    </div>`;
  
  await loadReportsHistory();
}

async function generatePerformanceReport() {
  const start = document.getElementById('rep-start').value;
  const end = document.getElementById('rep-end').value;
  const container = document.getElementById('report-result');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Gerando relatório...</span></div>';
  
  try {
    const data = await CRM.post('/reports/performance', { period_start: start, period_end: end });
    const report = data.data;
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title"><i class="fas fa-chart-bar" style="color:var(--accent)"></i> Relatório de Performance</div>
            <div class="card-subtitle">Período: ${start} a ${end}</div>
          </div>
          <span class="badge badge-success">Gerado</span>
        </div>
        
        <div class="grid-4" style="margin-bottom:20px">
          <div class="stat-card blue">
            <div class="stat-icon blue"><i class="fas fa-users"></i></div>
            <div class="stat-label">Total de Leads</div>
            <div class="stat-value">${report.totals?.total_leads || 0}</div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon green"><i class="fas fa-trophy"></i></div>
            <div class="stat-label">Fechados/Ganhos</div>
            <div class="stat-value">${report.totals?.won || 0}</div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon red"><i class="fas fa-times-circle"></i></div>
            <div class="stat-label">Perdidos</div>
            <div class="stat-value">${report.totals?.lost || 0}</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-icon orange"><i class="fas fa-dollar-sign"></i></div>
            <div class="stat-label">Receita</div>
            <div class="stat-value" style="font-size:18px">${CRM.formatMoney(report.totals?.revenue || 0)}</div>
          </div>
        </div>
        
        <div class="grid-2">
          <div>
            <label class="form-label">Por Estágio do Pipeline</label>
            <canvas id="repPipelineChart" height="200"></canvas>
          </div>
          <div>
            <label class="form-label">Por Tipo de Lead</label>
            <canvas id="repTypeChart" height="200"></canvas>
          </div>
        </div>
        
        <div style="margin-top:16px">
          <label class="form-label">Atividades Registradas</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${(report.activities || []).map(a => `
              <div style="background:var(--bg);padding:8px 14px;border-radius:8px;font-size:12px">
                <strong>${a.type}</strong>: ${a.count}x
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    
    // Charts
    renderReportCharts(report);
    loadReportsHistory();
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div></div>`;
  }
}

function renderReportCharts(report) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  
  const pipelineCanvas = document.getElementById('repPipelineChart');
  if (pipelineCanvas && report.pipeline) {
    if (CRM.charts.repPipeline) CRM.charts.repPipeline.destroy();
    CRM.charts.repPipeline = new Chart(pipelineCanvas, {
      type: 'doughnut',
      data: {
        labels: (report.pipeline || []).map(s => CRM.stageLabels[s.pipeline_stage] || s.pipeline_stage),
        datasets: [{ data: report.pipeline.map(s => s.count), backgroundColor: report.pipeline.map(s => CRM.stageColors[s.pipeline_stage] || '#64748b'), borderWidth: 2, borderColor: isDark ? '#1e293b' : '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 } } } } }
    });
  }
  
  const typeCanvas = document.getElementById('repTypeChart');
  if (typeCanvas && report.byType) {
    if (CRM.charts.repType) CRM.charts.repType.destroy();
    const typeColors = { pf: '#3b82f6', pme: '#8b5cf6', adhesion: '#10b981' };
    CRM.charts.repType = new Chart(typeCanvas, {
      type: 'pie',
      data: {
        labels: report.byType.map(t => CRM.typeLabels[t.lead_type] || t.lead_type),
        datasets: [{ data: report.byType.map(t => t.count), backgroundColor: report.byType.map(t => typeColors[t.lead_type] || '#64748b'), borderWidth: 2, borderColor: isDark ? '#1e293b' : '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 } } } } }
    });
  }
}

async function generateAIReport() {
  const start = document.getElementById('rep-start').value;
  const end = document.getElementById('rep-end').value;
  const container = document.getElementById('report-result');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>IA gerando relatório completo... aguarde.</span></div>';
  
  try {
    const perfData = await CRM.post('/reports/performance', { period_start: start, period_end: end });
    const aiData = await CRM.post('/ai/report', { report_data: perfData.data, report_type: 'performance' });
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title"><i class="fas fa-robot" style="color:var(--accent)"></i> Relatório Inteligente (IA)</div>
            <div class="card-subtitle">Análise gerada por IA para o período ${start} a ${end}</div>
          </div>
          <span class="badge badge-info">IA Gerado</span>
        </div>
        <div class="ai-report-content">${formatAIResponse(aiData.report)}</div>
      </div>`;
    loadReportsHistory();
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div></div>`;
  }
}

async function loadReportsHistory() {
  const container = document.getElementById('reports-history');
  if (!container) return;
  
  try {
    const data = await CRM.get('/reports');
    const reports = data.reports || [];
    
    if (reports.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fas fa-chart-bar"></i><p>Nenhum relatório gerado</p></div>';
      return;
    }
    
    container.innerHTML = `<div class="table-container"><table>
      <thead><tr><th>Título</th><th>Tipo</th><th>Período</th><th>Data</th></tr></thead>
      <tbody>${reports.map(r => `
        <tr>
          <td style="font-weight:500">${r.title}</td>
          <td><span class="badge badge-${r.type==='ai_generated'?'info':'secondary'}">${r.type==='ai_generated'?'IA':'Manual'}</span></td>
          <td style="font-size:12px">${r.period_start ? r.period_start + ' a ' + r.period_end : '-'}</td>
          <td style="font-size:12px">${CRM.formatDate(r.created_at)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  } catch (e) {}
}

// =====================================================
// IA ASSISTENTE
// =====================================================
let aiSessionId = null;
let aiIsTyping = false;

async function renderAI() {
  const content = document.getElementById('page-content');
  aiSessionId = 'session_' + Date.now();
  
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="fas fa-robot" style="color:var(--accent)"></i> IA Assistente</h1>
        <p class="page-subtitle">Seu assistente inteligente para corretagem de planos de saúde</p>
      </div>
    </div>
    
    <div class="grid-2" style="gap:20px;align-items:start">
      <!-- CHAT PRINCIPAL -->
      <div style="grid-column:1 / -1">
        <!-- AÇÕES RÁPIDAS -->
        <div class="ai-actions-grid" style="margin-bottom:16px">
          <button class="ai-action-btn" onclick="setAIContext('general')">
            <i class="fas fa-comments"></i> Chat Geral
          </button>
          <button class="ai-action-btn" onclick="setAIContext('script')">
            <i class="fas fa-file-alt"></i> Gerar Script
          </button>
          <button class="ai-action-btn" onclick="setAIContext('objection')">
            <i class="fas fa-shield-alt"></i> Superar Objeções
          </button>
          <button class="ai-action-btn" onclick="setAIContext('lead_analysis')">
            <i class="fas fa-user-cog"></i> Análise de Lead
          </button>
          <button class="ai-action-btn" onclick="setAIContext('report')">
            <i class="fas fa-chart-line"></i> Relatório IA
          </button>
          <button class="ai-action-btn" onclick="clearAIChat()">
            <i class="fas fa-trash"></i> Limpar Chat
          </button>
        </div>
        
        <!-- CONTEXTO SELECIONADO -->
        <div id="ai-context-bar" style="padding:10px 16px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:10px;margin-bottom:16px;font-size:12px;color:var(--accent)">
          <i class="fas fa-info-circle"></i> <span id="ai-context-label">Contexto: Chat Geral</span>
        </div>
        
        <!-- FERRAMENTAS ESPECIAIS -->
        <div id="ai-tools-panel" style="margin-bottom:16px;display:none">
          <!-- Painel de ferramentas especiais por contexto -->
        </div>
        
        <!-- CHAT -->
        <div class="ai-chat-container card" style="padding:0;overflow:hidden">
          <div class="ai-chat-header">
            <div class="ai-chat-icon"><i class="fas fa-robot"></i></div>
            <div>
              <div class="ai-chat-title">Assistente CRM Saúde PRO</div>
              <div class="ai-chat-subtitle">Powered by OpenAI GPT-4o-mini • Especialista em Planos de Saúde</div>
            </div>
          </div>
          
          <div class="ai-chat-messages" id="ai-messages">
            <div class="ai-message assistant">
              <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
              <div class="ai-message-content">
                Olá! Sou o Assistente IA do <strong>CRM Saúde PRO</strong>. 🏥<br><br>
                Estou aqui para te ajudar com:<br>
                • 📝 <strong>Scripts de vendas</strong> personalizados<br>
                • 🎯 <strong>Análise de perfil</strong> de leads<br>
                • 💬 <strong>Superação de objeções</strong><br>
                • 📊 <strong>Relatórios inteligentes</strong><br>
                • 💡 <strong>Estratégias de negociação</strong><br><br>
                Como posso te ajudar hoje?
              </div>
            </div>
          </div>
          
          <div class="ai-chat-input-area">
            <textarea class="ai-chat-input" id="ai-input" placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)" rows="1"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAIMessage()}"></textarea>
            <button class="ai-send-btn" id="ai-send-btn" onclick="sendAIMessage()" title="Enviar">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

let currentAIContext = 'general';
const aiContextLabels = {
  general: '💬 Chat Geral - Perguntas e suporte geral',
  script: '📝 Gerador de Scripts - Crie scripts de vendas eficazes',
  objection: '🛡️ Superação de Objeções - Respostas para objeções comuns',
  lead_analysis: '🎯 Análise de Lead - Insights sobre perfil do cliente',
  report: '📊 Relatório Inteligente - Análise de dados com IA'
};

function setAIContext(ctx) {
  currentAIContext = ctx;
  const label = document.getElementById('ai-context-label');
  if (label) label.textContent = 'Contexto: ' + aiContextLabels[ctx];
  
  // Mostrar ferramentas específicas do contexto
  const toolsPanel = document.getElementById('ai-tools-panel');
  if (toolsPanel) {
    if (ctx === 'script') {
      toolsPanel.style.display = 'block';
      toolsPanel.innerHTML = `
        <div class="card" style="background:var(--bg)">
          <div class="card-title" style="margin-bottom:12px;font-size:13px">⚡ Gerar Script Rápido</div>
          <div class="grid-3" style="gap:8px;margin-bottom:12px">
            <select class="form-control" id="quick-script-type">
              <option value="pf">Pessoa Física</option>
              <option value="pme">PME</option>
              <option value="adhesion">Adesão</option>
            </select>
            <select class="form-control" id="quick-script-stage">
              <option value="Primeiro contato">Primeiro contato</option>
              <option value="Qualificação">Qualificação</option>
              <option value="Proposta">Apresentação de proposta</option>
              <option value="Fechamento">Fechamento</option>
            </select>
            <button class="btn btn-primary" onclick="generateQuickScript()">
              <i class="fas fa-magic"></i> Gerar
            </button>
          </div>
        </div>`;
    } else if (ctx === 'objection') {
      toolsPanel.style.display = 'block';
      toolsPanel.innerHTML = `
        <div class="card" style="background:var(--bg)">
          <div class="card-title" style="margin-bottom:12px;font-size:13px">⚡ Objeções Comuns</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${['Está muito caro', 'Preciso pensar', 'Já tenho plano', 'Meu chefe precisa aprovar', 'Não tenho dinheiro agora'].map(obj =>
              `<button class="ai-action-btn" style="padding:8px 12px;font-size:12px" onclick="handleObjection('${obj}')">"${obj}"</button>`
            ).join('')}
          </div>
        </div>`;
    } else {
      toolsPanel.style.display = 'none';
    }
  }
  
  toast(`Contexto alterado: ${aiContextLabels[ctx].split(' - ')[0]}`, 'info', 2000);
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const message = input.value.trim();
  if (!message || aiIsTyping) return;
  
  input.value = '';
  input.style.height = 'auto';
  
  addChatMessage('user', message);
  
  const typingEl = addTypingIndicator();
  aiIsTyping = true;
  document.getElementById('ai-send-btn').disabled = true;
  
  try {
    const data = await CRM.post('/ai/chat', {
      message,
      context_type: currentAIContext,
      session_id: aiSessionId
    });
    
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', data.response);
    if (data.session_id) aiSessionId = data.session_id;
  } catch (e) {
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', `❌ ${e.message}`);
  } finally {
    aiIsTyping = false;
    document.getElementById('ai-send-btn').disabled = false;
  }
}

function addChatMessage(role, content) {
  const messages = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-message ${role}`;
  div.innerHTML = `
    <div class="ai-message-avatar"><i class="fas fa-${role==='user'?'user':'robot'}"></i></div>
    <div class="ai-message-content">${formatAIResponse(content)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const messages = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'ai-message assistant';
  div.innerHTML = `
    <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
    <div class="ai-typing"><span></span><span></span><span></span></div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function removeTypingIndicator(el) {
  if (el) el.remove();
}

function clearAIChat() {
  aiSessionId = 'session_' + Date.now();
  const messages = document.getElementById('ai-messages');
  if (messages) {
    messages.innerHTML = `
      <div class="ai-message assistant">
        <div class="ai-message-avatar"><i class="fas fa-robot"></i></div>
        <div class="ai-message-content">
          Chat limpo! Estou pronto para uma nova conversa. Como posso te ajudar? 😊
        </div>
      </div>`;
  }
}

async function generateQuickScript() {
  const type = document.getElementById('quick-script-type').value;
  const stage = document.getElementById('quick-script-stage').value;
  
  addChatMessage('user', `Gere um script de ${CRM.typeLabels[type]} para ${stage}`);
  const typingEl = addTypingIndicator();
  aiIsTyping = true;
  
  try {
    const data = await CRM.post('/ai/script', { lead_type: type, stage });
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', data.script);
  } catch (e) {
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', `❌ ${e.message}`);
  } finally {
    aiIsTyping = false;
  }
}

async function handleObjection(objection) {
  addChatMessage('user', `Como responder à objeção: "${objection}"`);
  const typingEl = addTypingIndicator();
  aiIsTyping = true;
  
  try {
    const data = await CRM.post('/ai/objections', { objection, lead_type: 'pf' });
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', data.response);
  } catch (e) {
    removeTypingIndicator(typingEl);
    addChatMessage('assistant', `❌ ${e.message}`);
  } finally {
    aiIsTyping = false;
  }
}

// =====================================================
// USUÁRIOS
// =====================================================
async function renderUsers() {
  if (!CRM.can(['admin', 'director', 'manager'])) {
    document.getElementById('page-content').innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-lock"></i><h3>Acesso Negado</h3><p>Você não tem permissão para ver esta área.</p></div></div>';
    return;
  }
  
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-user-shield" style="color:var(--accent)"></i> Gerenciamento de Usuários</h1>
        <p class="page-subtitle">Controle de acesso e permissões</p></div>
      ${CRM.can(['admin']) ? `<button class="btn btn-primary" onclick="showAddUserModal()"><i class="fas fa-user-plus"></i> Novo Usuário</button>` : ''}
    </div>
    
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="search-bar" style="flex:1">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Buscar usuário..." oninput="loadUsersTable(this.value)">
        </div>
        <select class="form-control" style="width:auto" onchange="loadUsersTable('',this.value)">
          <option value="">Todos os cargos</option>
          <option value="admin">Administrador</option>
          <option value="director">Diretor</option>
          <option value="manager">Gerente</option>
          <option value="broker">Corretor</option>
        </select>
      </div>
    </div>
    
    <div class="card" id="users-table">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>`;
  
  await loadUsersTable();
}

async function loadUsersTable(search = '', role = '') {
  const container = document.getElementById('users-table');
  if (!container) return;
  
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    
    const data = await CRM.get(`/users?${params}`);
    const users = data.users || [];
    
    const roleColors = { admin: 'danger', director: 'info', manager: 'warning', broker: 'success' };
    const roleIcons = { admin: 'fa-shield-alt', director: 'fa-crown', manager: 'fa-user-tie', broker: 'fa-user' };
    
    container.innerHTML = users.length === 0 ?
      '<div class="empty-state"><i class="fas fa-users"></i><h3>Nenhum usuário</h3></div>' :
      `<div class="table-container"><table>
        <thead><tr><th>Usuário</th><th>Cargo</th><th>E-mail</th><th>Status</th><th>Último Acesso</th>${CRM.can(['admin']) ? '<th>Ações</th>' : ''}</tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div class="user-avatar">${u.name[0].toUpperCase()}</div>
                <div>
                  <div style="font-weight:600">${u.name}</div>
                  ${u.phone ? `<div style="font-size:11px;color:var(--text-secondary)">${u.phone}</div>` : ''}
                </div>
              </div>
            </td>
            <td>
              <span class="badge badge-${roleColors[u.role]}">
                <i class="fas ${roleIcons[u.role]}"></i> ${CRM.roleLabel(u.role)}
              </span>
            </td>
            <td style="font-size:13px">${u.email}</td>
            <td><span class="badge badge-${u.active ? 'success' : 'danger'}">${u.active ? 'Ativo' : 'Inativo'}</span></td>
            <td style="font-size:12px;color:var(--text-secondary)">${u.last_login ? CRM.timeAgo(u.last_login) : 'Nunca'}</td>
            ${CRM.can(['admin']) ? `
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-sm btn-secondary" onclick="showEditUserModal('${u.id}','${u.name}','${u.email}','${u.role}','${u.phone||''}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-${u.active?'warning':'success'}" onclick="toggleUser('${u.id}','${u.name}',${u.active})" title="${u.active?'Desativar':'Ativar'}">
                    <i class="fas fa-${u.active?'ban':'check'}"></i>
                  </button>
                  ${u.id !== CRM.user.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}','${u.name}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
              </td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}

function showAddUserModal() {
  showModal('Novo Usuário', getUserFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitUserForm(null)"><i class="fas fa-user-plus"></i> Criar</button>`);
}

function showEditUserModal(id, name, email, role, phone) {
  showModal('Editar Usuário', getUserFormHTML({ id, name, email, role, phone }),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitUserForm('${id}')"><i class="fas fa-save"></i> Salvar</button>`);
}

function getUserFormHTML(user = null) {
  const v = (f) => user ? (user[f] || '') : '';
  return `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Nome Completo *</label>
        <input type="text" class="form-control" id="uf-name" value="${v('name')}">
      </div>
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input type="tel" class="form-control" id="uf-phone" value="${v('phone')}" placeholder="(00) 00000-0000">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">E-mail *</label>
      <input type="email" class="form-control" id="uf-email" value="${v('email')}">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Cargo / Permissão *</label>
        <select class="form-control" id="uf-role">
          <option value="broker" ${v('role')==='broker'?'selected':''}>Corretor</option>
          <option value="manager" ${v('role')==='manager'?'selected':''}>Gerente</option>
          <option value="director" ${v('role')==='director'?'selected':''}>Diretor</option>
          <option value="admin" ${v('role')==='admin'?'selected':''}>Administrador</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">${user ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
        <input type="password" class="form-control" id="uf-password" ${user ? '' : 'required'} placeholder="${user ? 'Nova senha...' : 'Senha...'}" autocomplete="new-password">
      </div>
    </div>
    ${user ? `<div class="form-group"><label class="form-label">Status</label>
      <select class="form-control" id="uf-active">
        <option value="true">Ativo</option>
        <option value="false">Inativo</option>
      </select></div>` : ''}
    
    <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;padding:12px;font-size:12px;color:var(--accent)">
      <i class="fas fa-info-circle"></i> <strong>Permissões por Cargo:</strong><br>
      <strong>Admin:</strong> Acesso total + gerenciamento de usuários<br>
      <strong>Diretor:</strong> Visualização total do dashboard e relatórios<br>
      <strong>Gerente:</strong> Visualização completa do dashboard<br>
      <strong>Corretor:</strong> Produção individual, criar leads e mover pipeline
    </div>`;
}

async function submitUserForm(id) {
  const data = {
    name: document.getElementById('uf-name').value,
    email: document.getElementById('uf-email').value,
    role: document.getElementById('uf-role').value,
    phone: document.getElementById('uf-phone').value,
    password: document.getElementById('uf-password').value,
    active: id ? document.getElementById('uf-active')?.value === 'true' : undefined
  };
  
  if (!data.name || !data.email || !data.role) { toast('Preencha os campos obrigatórios', 'error'); return; }
  if (!id && !data.password) { toast('Senha obrigatória para novo usuário', 'error'); return; }
  
  try {
    if (id) {
      await CRM.put(`/users/${id}`, data);
      toast('Usuário atualizado!', 'success');
    } else {
      await CRM.post('/users', data);
      toast('Usuário criado com sucesso!', 'success');
    }
    closeModal();
    loadUsersTable();
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleUser(id, name, active) {
  try {
    const result = await CRM.patch(`/users/${id}/toggle`, {});
    toast(`Usuário "${name}" ${result.active ? 'ativado' : 'desativado'}`, 'success');
    loadUsersTable();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(id, name) {
  confirm(`Excluir permanentemente o usuário "${name}"?`, async () => {
    try {
      await CRM.delete(`/users/${id}`);
      toast('Usuário excluído', 'success');
      loadUsersTable();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// =====================================================
// CONFIGURAÇÕES
// =====================================================
function renderSettings() {
  const content = document.getElementById('page-content');
  const isAdmin = CRM.can(['admin']);
  const isDirectorOrAbove = CRM.can(['admin', 'director', 'manager']);
  
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-cog" style="color:var(--accent)"></i> Configurações</h1>
        <p class="page-subtitle">Personalize sua experiência no CRM</p></div>
    </div>
    
    <div class="grid-2" style="gap:20px;align-items:start">
      <!-- PERFIL -->
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-user-circle" style="color:var(--accent)"></i> Meu Perfil</div></div>
        
        <div style="text-align:center;margin-bottom:20px">
          <div class="user-avatar" style="width:80px;height:80px;font-size:28px;margin:0 auto 12px">${CRM.user.name[0].toUpperCase()}</div>
          <div style="font-size:18px;font-weight:700">${CRM.user.name}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${CRM.user.email}</div>
          <span class="badge badge-info" style="margin-top:8px">${CRM.roleLabel(CRM.user.role)}</span>
        </div>
        
        <div class="form-group">
          <label class="form-label">Nome Completo</label>
          <input type="text" class="form-control" id="profile-name" value="${CRM.user.name}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input type="tel" class="form-control" id="profile-phone" value="${CRM.user.phone || ''}">
        </div>
        <div style="border-top:1px solid var(--card-border);padding-top:16px;margin-top:16px">
          <label class="form-label">Alterar Senha</label>
          <input type="password" class="form-control" id="profile-current-pwd" placeholder="Senha atual" style="margin-bottom:8px" autocomplete="current-password">
          <input type="password" class="form-control" id="profile-new-pwd" placeholder="Nova senha" autocomplete="new-password">
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="saveProfile()">
          <i class="fas fa-save"></i> Salvar Perfil
        </button>
      </div>
      
      <div>
        <!-- APARÊNCIA -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title"><i class="fas fa-palette" style="color:var(--accent)"></i> Aparência</div></div>
          
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--card-border)">
            <div>
              <div style="font-weight:500;font-size:14px">Tema</div>
              <div style="font-size:12px;color:var(--text-secondary)">Modo claro ou escuro</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm ${CRM.user.theme==='light'?'btn-primary':'btn-secondary'}" onclick="setTheme('light')">
                <i class="fas fa-sun"></i> Claro
              </button>
              <button class="btn btn-sm ${CRM.user.theme==='dark'||!CRM.user.theme?'btn-primary':'btn-secondary'}" onclick="setTheme('dark')">
                <i class="fas fa-moon"></i> Escuro
              </button>
            </div>
          </div>
          
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0">
            <div>
              <div style="font-weight:500;font-size:14px">Barra Lateral</div>
              <div style="font-size:12px;color:var(--text-secondary)">Expandida ou recolhida</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('sidebar-toggle').click()">
              <i class="fas fa-bars"></i> Alternar
            </button>
          </div>
        </div>
        
        ${isAdmin ? `
        <!-- CONFIGURAÇÕES DO SISTEMA (ADMIN) -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title"><i class="fas fa-shield-alt" style="color:#ef4444"></i> Configurações do Sistema</div></div>
          
          <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#ef4444">
            <i class="fas fa-exclamation-triangle"></i> Área restrita para Administradores
          </div>
          
          <div class="form-group">
            <label class="form-label">OpenAI API Key</label>
            <input type="password" class="form-control" id="cfg-openai-key" placeholder="sk-...">
            <small style="color:var(--text-secondary)">Configure a API Key do OpenAI para a IA funcionar</small>
          </div>
          <button class="btn btn-primary" onclick="saveSystemConfig()" style="margin-bottom:12px">
            <i class="fas fa-save"></i> Salvar Configuração
          </button>
          
          <div style="border-top:1px solid var(--card-border);padding-top:16px">
            <button class="btn btn-primary" onclick="navigateTo('users')" style="width:100%">
              <i class="fas fa-users"></i> Gerenciar Usuários
            </button>
          </div>
        </div>` : ''}
        
        <!-- INFO DO SISTEMA -->
        <div class="card">
          <div class="card-header"><div class="card-title"><i class="fas fa-info-circle" style="color:var(--accent)"></i> Informações do Sistema</div></div>
          <div style="font-size:13px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--card-border)">
              <span style="color:var(--text-secondary)">Versão</span><strong>CRM Saúde PRO v1.0</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--card-border)">
              <span style="color:var(--text-secondary)">Plataforma</span><strong>Cloudflare Pages</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--card-border)">
              <span style="color:var(--text-secondary)">Banco de Dados</span><strong>Cloudflare D1 (SQLite)</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--card-border)">
              <span style="color:var(--text-secondary)">IA</span><strong>OpenAI GPT-4o-mini</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0">
              <span style="color:var(--text-secondary)">Seu Cargo</span>
              <strong>${CRM.roleLabel(CRM.user.role)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

async function saveProfile() {
  const data = {
    name: document.getElementById('profile-name').value,
    phone: document.getElementById('profile-phone').value,
    currentPassword: document.getElementById('profile-current-pwd').value,
    newPassword: document.getElementById('profile-new-pwd').value
  };
  
  if (!data.name) { toast('Nome obrigatório', 'error'); return; }
  
  try {
    await CRM.put('/auth/profile', data);
    CRM.user.name = data.name;
    localStorage.setItem('crm_user', JSON.stringify(CRM.user));
    renderTopbar();
    renderSidebar();
    toast('Perfil salvo!', 'success');
    document.getElementById('profile-current-pwd').value = '';
    document.getElementById('profile-new-pwd').value = '';
  } catch (e) { toast(e.message, 'error'); }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  CRM.user.theme = theme;
  localStorage.setItem('crm_user', JSON.stringify(CRM.user));
  CRM.patch('/auth/theme', { theme }).catch(() => {});
  updateThemeBtn();
  renderSettings();
}

async function saveSystemConfig() {
  toast('Para configurar a OpenAI API Key, use as variáveis de ambiente do Cloudflare Workers: OPENAI_API_KEY', 'info', 6000);
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================
window.addEventListener('DOMContentLoaded', () => {
  if (CRM.token && CRM.user) {
    const theme = CRM.user.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    renderApp();
  } else {
    renderLogin();
  }
});
