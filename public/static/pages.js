// CRM Saúde PRO - Pipeline e Leads

// =====================================================
// PIPELINE (KANBAN)
// =====================================================
let pipelineLeads = [];
let pipelineFilter = { type: '', search: '' };

async function renderPipeline() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-filter" style="color:var(--accent)"></i> Pipeline de Vendas</h1>
        <p class="page-subtitle">Gerencie seus leads por etapa do funil</p></div>
      <button class="btn btn-primary" onclick="showAddLeadModal()"><i class="fas fa-plus"></i> Novo Lead</button>
    </div>
    
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <div class="search-bar" style="flex:1;min-width:200px">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Buscar leads..." oninput="pipelineFilter.search=this.value;debouncedLoadPipeline()">
        </div>
        <select class="form-control" style="width:auto" onchange="pipelineFilter.type=this.value;loadPipelineBoard()">
          <option value="">Todos os tipos</option>
          <option value="pf">Pessoa Física</option>
          <option value="pme">PME</option>
          <option value="adhesion">Adesão</option>
        </select>
      </div>
    </div>
    
    <div class="pipeline-container" id="pipeline-board">
      <div class="loading-overlay" style="width:100%"><div class="spinner"></div><span>Carregando pipeline...</span></div>
    </div>`;
  
  await loadPipelineBoard();
}

const debouncedLoadPipeline = debounce(() => loadPipelineBoard(), 300);

async function loadPipelineBoard() {
  try {
    const params = new URLSearchParams();
    if (pipelineFilter.type) params.set('type', pipelineFilter.type);
    if (pipelineFilter.search) params.set('search', pipelineFilter.search);
    params.set('limit', '100');
    
    const data = await CRM.get(`/leads?${params}`);
    pipelineLeads = data.leads || [];
    
    const stages = Object.keys(CRM.stageLabels);
    const board = document.getElementById('pipeline-board');
    
    board.innerHTML = stages.map(stage => {
      const stageleads = pipelineLeads.filter(l => l.pipeline_stage === stage);
      const totalValue = stageleads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
      
      return `
        <div class="pipeline-col" id="col-${stage}" ondragover="event.preventDefault();this.classList.add('drag-over')" 
          ondragleave="this.classList.remove('drag-over')" ondrop="onDrop(event,'${stage}')">
          <div class="pipeline-col-header">
            <div>
              <div class="pipeline-col-title" style="display:flex;align-items:center;gap:6px">
                <span style="width:10px;height:10px;border-radius:50%;background:${CRM.stageColors[stage]};display:inline-block"></span>
                ${CRM.stageLabels[stage]}
              </div>
              <div style="font-size:11px;color:var(--text-secondary)">${CRM.formatMoney(totalValue)}</div>
            </div>
            <span class="pipeline-col-count">${stageleads.length}</span>
          </div>
          ${stageleads.map(lead => renderKanbanCard(lead)).join('')}
          <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px" onclick="showAddLeadModal('${stage}')">
            <i class="fas fa-plus"></i> Adicionar
          </button>
        </div>`;
    }).join('');
    
  } catch (e) {
    document.getElementById('pipeline-board').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div>`;
  }
}

function renderKanbanCard(lead) {
  return `
    <div class="pipeline-card stage-${lead.pipeline_stage}" draggable="true" 
      ondragstart="onDragStart(event,'${lead.id}')" ondragend="onDragEnd(event)"
      onclick="openLeadDetail('${lead.id}')">
      <div class="pipeline-card-name">${lead.name}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="pipeline-card-type type-${lead.lead_type}">${CRM.typeLabels[lead.lead_type]}</span>
        <span class="badge badge-priority-${lead.priority}">${lead.priority}</span>
      </div>
      <div class="pipeline-card-value">${CRM.formatMoney(lead.estimated_value)}</div>
      <div class="pipeline-card-meta">
        <span><i class="fas fa-phone" style="font-size:10px"></i> ${lead.phone}</span>
        ${lead.assigned_name ? `<span><i class="fas fa-user" style="font-size:10px"></i> ${lead.assigned_name}</span>` : ''}
        <span>${CRM.timeAgo(lead.updated_at)}</span>
      </div>
    </div>`;
}

let dragLeadId = null;
function onDragStart(e, leadId) { dragLeadId = leadId; e.target.classList.add('dragging'); }
function onDragEnd(e) { e.target.classList.remove('dragging'); document.querySelectorAll('.pipeline-col').forEach(c => c.classList.remove('drag-over')); }

async function onDrop(e, stage) {
  e.preventDefault();
  document.querySelectorAll('.pipeline-col').forEach(c => c.classList.remove('drag-over'));
  if (!dragLeadId) return;
  
  const lead = pipelineLeads.find(l => l.id === dragLeadId);
  if (!lead || lead.pipeline_stage === stage) return;
  
  try {
    await CRM.patch(`/leads/${dragLeadId}/stage`, { stage });
    toast(`Lead movido para "${CRM.stageLabels[stage]}"`, 'success');
    loadPipelineBoard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// =====================================================
// LEADS
// =====================================================
let leadsData = [];
let leadsFilter = { type: '', stage: '', search: '', page: 1 };

async function renderLeads() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-users" style="color:var(--accent)"></i> Leads</h1>
        <p class="page-subtitle">Gerenciamento completo de leads</p></div>
      <button class="btn btn-primary" onclick="showAddLeadModal()"><i class="fas fa-plus"></i> Novo Lead</button>
    </div>
    
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="search-bar" style="flex:1;min-width:200px">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Buscar por nome, email ou telefone..." id="leads-search" oninput="leadsFilter.search=this.value;leadsFilter.page=1;debouncedLoadLeads()">
        </div>
        <select class="form-control" style="width:auto" id="leads-type-filter" onchange="leadsFilter.type=this.value;leadsFilter.page=1;loadLeadsTable()">
          <option value="">Todos os tipos</option>
          <option value="pf">Pessoa Física</option>
          <option value="pme">PME</option>
          <option value="adhesion">Adesão</option>
        </select>
        <select class="form-control" style="width:auto" onchange="leadsFilter.stage=this.value;leadsFilter.page=1;loadLeadsTable()">
          <option value="">Todos os estágios</option>
          ${Object.entries(CRM.stageLabels).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div class="card">
      <div id="leads-table-container">
        <div class="loading-overlay"><div class="spinner"></div><span>Carregando leads...</span></div>
      </div>
    </div>`;
  
  await loadLeadsTable();
}

const debouncedLoadLeads = debounce(() => loadLeadsTable(), 300);

async function loadLeadsTable() {
  const container = document.getElementById('leads-table-container');
  if (!container) return;
  
  try {
    const params = new URLSearchParams();
    if (leadsFilter.type) params.set('type', leadsFilter.type);
    if (leadsFilter.stage) params.set('stage', leadsFilter.stage);
    if (leadsFilter.search) params.set('search', leadsFilter.search);
    params.set('page', leadsFilter.page);
    params.set('limit', '20');
    
    const data = await CRM.get(`/leads?${params}`);
    leadsData = data.leads || [];
    
    if (leadsData.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><h3>Nenhum lead encontrado</h3><p>Crie seu primeiro lead clicando em "Novo Lead"</p></div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Estágio</th>
              <th>Telefone</th>
              <th>Valor</th>
              <th>Prioridade</th>
              <th>Responsável</th>
              <th>Atualização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${leadsData.map(l => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="user-avatar" style="width:32px;height:32px;font-size:12px">${l.name[0].toUpperCase()}</div>
                    <div>
                      <div style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="openLeadDetail('${l.id}')">${l.name}</div>
                      ${l.email ? `<div style="font-size:11px;color:var(--text-secondary)">${l.email}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td><span class="pipeline-card-type type-${l.lead_type}">${CRM.typeLabels[l.lead_type]}</span></td>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500">
                    <span style="width:8px;height:8px;border-radius:50%;background:${CRM.stageColors[l.pipeline_stage]}"></span>
                    ${CRM.stageLabels[l.pipeline_stage]}
                  </span>
                </td>
                <td style="font-size:12px">${l.phone}</td>
                <td style="font-weight:600;color:var(--accent)">${CRM.formatMoney(l.estimated_value)}</td>
                <td><span class="badge badge-priority-${l.priority}">${l.priority}</span></td>
                <td style="font-size:12px">${l.assigned_name || '-'}</td>
                <td style="font-size:11px;color:var(--text-secondary)">${CRM.timeAgo(l.updated_at)}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-secondary" onclick="openLeadDetail('${l.id}')" title="Detalhes"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-secondary" onclick="showEditLeadModal('${l.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    ${CRM.can(['admin','director','manager']) ? `<button class="btn btn-sm btn-danger" onclick="deleteLead('${l.id}','${l.name.replace(/'/g,'\\\'')}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div>`;
  }
}

function filterLeadType(type) {
  leadsFilter.type = type;
  const select = document.getElementById('leads-type-filter');
  if (select) select.value = type;
  loadLeadsTable();
}

// FORMULÁRIO DE LEAD
function showAddLeadModal(defaultStage) {
  showModal('Novo Lead', getLeadFormHTML(null, defaultStage),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitLeadForm(null)"><i class="fas fa-save"></i> Salvar</button>`,
    '700px');
  initLeadFormListeners();
}

async function showEditLeadModal(id) {
  try {
    const data = await CRM.get(`/leads/${id}`);
    showModal('Editar Lead', getLeadFormHTML(data.lead),
      `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
       <button class="btn btn-primary" onclick="submitLeadForm('${id}')"><i class="fas fa-save"></i> Salvar</button>`,
      '700px');
    initLeadFormListeners();
  } catch (e) { toast(e.message, 'error'); }
}

function getLeadFormHTML(lead = null, defaultStage = null) {
  const v = (f) => lead ? (lead[f] || '') : '';
  return `
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(event,'tab-basic')">Dados Básicos</button>
      <button class="tab-btn" onclick="switchTab(event,'tab-commercial')">Comercial</button>
      <button class="tab-btn" onclick="switchTab(event,'tab-address')">Endereço</button>
    </div>
    
    <div class="tab-content active" id="tab-basic">
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Tipo de Lead *</label>
          <select class="form-control" id="lf-type" required>
            <option value="">Selecione...</option>
            <option value="pf" ${v('lead_type')==='pf'?'selected':''}>Pessoa Física</option>
            <option value="pme" ${v('lead_type')==='pme'?'selected':''}>PME / Empresarial</option>
            <option value="adhesion" ${v('lead_type')==='adhesion'?'selected':''}>Adesão</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Prioridade</label>
          <select class="form-control" id="lf-priority">
            <option value="low" ${v('priority')==='low'?'selected':''}>Baixa</option>
            <option value="medium" ${v('priority')==='medium'||!lead?'selected':''}>Média</option>
            <option value="high" ${v('priority')==='high'?'selected':''}>Alta</option>
          </select>
        </div>
      </div>
      
      <div class="form-group" id="field-name">
        <label class="form-label">Nome Completo *</label>
        <input type="text" class="form-control" id="lf-name" value="${v('name')}" required>
      </div>
      
      <div class="form-group" id="field-company" style="display:none">
        <label class="form-label">Razão Social / Nome da Empresa *</label>
        <input type="text" class="form-control" id="lf-company" value="${v('company_name')}">
      </div>
      
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Telefone / WhatsApp *</label>
          <input type="tel" class="form-control" id="lf-phone" value="${v('phone')}" placeholder="(00) 00000-0000" required>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-control" id="lf-email" value="${v('email')}">
        </div>
      </div>
      
      <div class="grid-2" id="pf-fields">
        <div class="form-group">
          <label class="form-label">CPF</label>
          <input type="text" class="form-control" id="lf-cpf" value="${v('cpf')}" placeholder="000.000.000-00">
        </div>
        <div class="form-group">
          <label class="form-label">Data de Nascimento</label>
          <input type="date" class="form-control" id="lf-birth" value="${v('birth_date')}">
        </div>
      </div>
      
      <div class="grid-2" id="pme-fields" style="display:none">
        <div class="form-group">
          <label class="form-label">CNPJ</label>
          <input type="text" class="form-control" id="lf-cnpj" value="${v('cnpj')}" placeholder="00.000.000/0000-00">
        </div>
        <div class="form-group">
          <label class="form-label">Qtd. Funcionários</label>
          <input type="text" class="form-control" id="lf-company-size" value="${v('company_size')}" placeholder="Ex: 10-50">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Origem do Lead</label>
        <select class="form-control" id="lf-source">
          <option value="">Selecione...</option>
          ${['Indicação','WhatsApp','Site','LinkedIn','Instagram','Facebook','Google Ads','Ligação ativa','E-mail marketing','Outros'].map(s => `<option value="${s}" ${v('source')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div class="tab-content" id="tab-commercial">
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Valor Estimado (R$)</label>
          <input type="number" class="form-control" id="lf-value" value="${v('estimated_value')}" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">Prêmio Mensal (R$)</label>
          <input type="number" class="form-control" id="lf-premium" value="${v('monthly_premium')}" placeholder="0.00">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Qtd. de Vidas</label>
          <input type="number" class="form-control" id="lf-lives" value="${v('lives_count') || 1}" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Operadora</label>
          <input type="text" class="form-control" id="lf-operator" value="${v('operator')}" placeholder="Bradesco, SulAmérica, Unimed...">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Plano Atual</label>
          <input type="text" class="form-control" id="lf-current-plan" value="${v('current_plan')}">
        </div>
        <div class="form-group">
          <label class="form-label">Plano Desejado</label>
          <input type="text" class="form-control" id="lf-desired-plan" value="${v('desired_plan')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observações / Notas</label>
        <textarea class="form-control" id="lf-notes" rows="3" placeholder="Informações relevantes sobre o lead...">${v('notes')}</textarea>
      </div>
    </div>
    
    <div class="tab-content" id="tab-address">
      <div class="form-group">
        <label class="form-label">Endereço</label>
        <input type="text" class="form-control" id="lf-address" value="${v('address')}">
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Cidade</label>
          <input type="text" class="form-control" id="lf-city" value="${v('city')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <input type="text" class="form-control" id="lf-state" value="${v('state')}" maxlength="2" placeholder="SP">
        </div>
        <div class="form-group">
          <label class="form-label">CEP</label>
          <input type="text" class="form-control" id="lf-zip" value="${v('zip_code')}" placeholder="00000-000">
        </div>
      </div>
    </div>`;
}

function initLeadFormListeners() {
  const typeSelect = document.getElementById('lf-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', function() {
      const isPME = this.value === 'pme';
      document.getElementById('pf-fields').style.display = isPME ? 'none' : 'grid';
      document.getElementById('pme-fields').style.display = isPME ? 'grid' : 'none';
      document.getElementById('field-company').style.display = isPME ? 'block' : 'none';
    });
    typeSelect.dispatchEvent(new Event('change'));
  }
}

async function submitLeadForm(id) {
  const data = {
    name: document.getElementById('lf-name')?.value || document.getElementById('lf-company')?.value,
    phone: document.getElementById('lf-phone').value,
    email: document.getElementById('lf-email').value,
    lead_type: document.getElementById('lf-type').value,
    priority: document.getElementById('lf-priority').value,
    cpf: document.getElementById('lf-cpf')?.value,
    cnpj: document.getElementById('lf-cnpj')?.value,
    birth_date: document.getElementById('lf-birth')?.value,
    company_name: document.getElementById('lf-company')?.value,
    company_size: document.getElementById('lf-company-size')?.value,
    source: document.getElementById('lf-source').value,
    estimated_value: parseFloat(document.getElementById('lf-value').value) || 0,
    monthly_premium: parseFloat(document.getElementById('lf-premium').value) || 0,
    lives_count: parseInt(document.getElementById('lf-lives').value) || 1,
    operator: document.getElementById('lf-operator').value,
    current_plan: document.getElementById('lf-current-plan').value,
    desired_plan: document.getElementById('lf-desired-plan').value,
    notes: document.getElementById('lf-notes').value,
    address: document.getElementById('lf-address').value,
    city: document.getElementById('lf-city').value,
    state: document.getElementById('lf-state').value,
    zip_code: document.getElementById('lf-zip').value,
  };
  
  if (!data.name || !data.phone || !data.lead_type) {
    toast('Preencha os campos obrigatórios: Tipo, Nome e Telefone', 'error');
    return;
  }
  
  try {
    if (id) {
      await CRM.put(`/leads/${id}`, data);
      toast('Lead atualizado com sucesso!', 'success');
    } else {
      await CRM.post('/leads', data);
      toast('Lead criado com sucesso!', 'success');
    }
    closeModal();
    if (CRM.currentPage === 'pipeline') loadPipelineBoard();
    else if (CRM.currentPage === 'leads') loadLeadsTable();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteLead(id, name) {
  confirm(`Excluir o lead "${name}"? Esta ação não pode ser desfeita.`, async () => {
    try {
      await CRM.delete(`/leads/${id}`);
      toast('Lead excluído', 'success');
      loadLeadsTable();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// DETALHE DO LEAD
async function openLeadDetail(id) {
  try {
    const data = await CRM.get(`/leads/${id}`);
    const lead = data.lead;
    const actIcons = { call: 'fa-phone', email: 'fa-envelope', meeting: 'fa-calendar', whatsapp: 'fa-whatsapp', pipeline_change: 'fa-exchange-alt', note: 'fa-sticky-note', proposal: 'fa-file-contract' };
    
    showModal(`<i class="fas fa-user" style="color:var(--accent)"></i> ${lead.name}`, `
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab-btn active" onclick="switchTab(event,'dtab-info')">Informações</button>
        <button class="tab-btn" onclick="switchTab(event,'dtab-activities')">Atividades</button>
        <button class="tab-btn" onclick="switchTab(event,'dtab-stage')">Pipeline</button>
        <button class="tab-btn" onclick="switchTab(event,'dtab-ai')">IA Insights</button>
      </div>
      
      <div class="tab-content active" id="dtab-info">
        <div class="grid-2" style="margin-bottom:16px">
          <div><label class="form-label">Tipo</label><div><span class="pipeline-card-type type-${lead.lead_type}">${CRM.typeLabels[lead.lead_type]}</span></div></div>
          <div><label class="form-label">Estágio</label><div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${CRM.stageColors[lead.pipeline_stage]}"></span>${CRM.stageLabels[lead.pipeline_stage]}</div></div>
          <div><label class="form-label">Telefone</label><div style="font-size:14px">${lead.phone}</div></div>
          <div><label class="form-label">E-mail</label><div style="font-size:14px">${lead.email || '-'}</div></div>
          <div><label class="form-label">Valor Estimado</label><div style="font-size:16px;font-weight:700;color:var(--accent)">${CRM.formatMoney(lead.estimated_value)}</div></div>
          <div><label class="form-label">Prêmio Mensal</label><div style="font-size:14px;font-weight:600">${CRM.formatMoney(lead.monthly_premium)}</div></div>
          <div><label class="form-label">Prioridade</label><div><span class="badge badge-priority-${lead.priority}">${lead.priority}</span></div></div>
          <div><label class="form-label">Origem</label><div>${lead.source || '-'}</div></div>
          ${lead.company_name ? `<div><label class="form-label">Empresa</label><div>${lead.company_name}</div></div>` : ''}
          ${lead.operator ? `<div><label class="form-label">Operadora</label><div>${lead.operator}</div></div>` : ''}
          <div><label class="form-label">Responsável</label><div>${lead.assigned_name || '-'}</div></div>
          <div><label class="form-label">Criado em</label><div>${CRM.formatDate(lead.created_at)}</div></div>
        </div>
        ${lead.notes ? `<div class="form-group"><label class="form-label">Notas</label><div style="background:var(--bg);padding:12px;border-radius:8px;font-size:13px">${lead.notes}</div></div>` : ''}
      </div>
      
      <div class="tab-content" id="dtab-activities">
        <div style="margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="showAddActivityModal('${id}')"><i class="fas fa-plus"></i> Nova Atividade</button>
        </div>
        ${(data.activities || []).length === 0 ? '<div class="empty-state"><i class="fas fa-history"></i><p>Nenhuma atividade registrada</p></div>' :
          (data.activities || []).map(a => `
            <div class="activity-item">
              <div class="activity-icon ${a.type}"><i class="fas ${actIcons[a.type] || 'fa-circle'}"></i></div>
              <div class="activity-content">
                <div class="activity-title">${a.title}</div>
                ${a.outcome ? `<div class="activity-outcome">"${a.outcome}"</div>` : ''}
                <div class="activity-time">${a.user_name} • ${CRM.formatDateTime(a.created_at)}</div>
              </div>
            </div>`).join('')}
      </div>
      
      <div class="tab-content" id="dtab-stage">
        <div class="form-group">
          <label class="form-label">Mover para Estágio</label>
          <select class="form-control" id="stage-select" style="margin-bottom:12px">
            ${Object.entries(CRM.stageLabels).map(([k,v]) => `<option value="${k}" ${lead.pipeline_stage===k?'selected':''}>${v}</option>`).join('')}
          </select>
          <input type="text" class="form-control" id="stage-reason" placeholder="Motivo da mudança (opcional)">
          <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="moveLeadStage('${id}')">
            <i class="fas fa-exchange-alt"></i> Confirmar Mudança
          </button>
        </div>
        <div>
          <label class="form-label">Histórico do Pipeline</label>
          ${(data.history || []).map(h => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--card-border);font-size:12px">
              <i class="fas fa-arrow-right" style="color:var(--accent)"></i>
              <span>${h.from_stage ? CRM.stageLabels[h.from_stage] + ' →' : 'Criado como'} <strong>${CRM.stageLabels[h.to_stage]}</strong></span>
              <span style="color:var(--text-secondary);margin-left:auto">${CRM.timeAgo(h.created_at)}</span>
            </div>`).join('')}
        </div>
      </div>
      
      <div class="tab-content" id="dtab-ai">
        <button class="btn btn-primary" style="width:100%" onclick="analyzeLeadAI('${id}','${lead.name}')">
          <i class="fas fa-robot"></i> Analisar com IA
        </button>
        <div id="ai-lead-analysis" style="margin-top:16px"></div>
      </div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
       <button class="btn btn-warning" onclick="closeModal();showEditLeadModal('${id}')"><i class="fas fa-edit"></i> Editar</button>`,
      '700px');
  } catch (e) { toast(e.message, 'error'); }
}

async function moveLeadStage(id) {
  const stage = document.getElementById('stage-select').value;
  const reason = document.getElementById('stage-reason').value;
  try {
    await CRM.patch(`/leads/${id}/stage`, { stage, reason });
    toast(`Movido para "${CRM.stageLabels[stage]}"`, 'success');
    closeModal();
    if (CRM.currentPage === 'pipeline') loadPipelineBoard();
    else if (CRM.currentPage === 'leads') loadLeadsTable();
  } catch (e) { toast(e.message, 'error'); }
}

async function analyzeLeadAI(id, name) {
  const container = document.getElementById('ai-lead-analysis');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>IA analisando o lead...</span></div>';
  try {
    const data = await CRM.post('/ai/analyze-lead', { lead_id: id });
    container.innerHTML = `
      <div class="card" style="background:var(--bg)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="fas fa-robot" style="color:var(--accent);font-size:18px"></i>
          <strong>Análise IA para ${name}</strong>
        </div>
        <div class="ai-report-content">${formatAIResponse(data.analysis)}</div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div>`;
  }
}

// ATIVIDADES
function showAddActivityModal(leadId) {
  showModal('Nova Atividade', `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <select class="form-control" id="af-type">
          <option value="call">Ligação</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">E-mail</option>
          <option value="meeting">Reunião</option>
          <option value="note">Nota</option>
          <option value="follow_up">Follow-up</option>
          <option value="proposal">Proposta</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Duração (min)</label>
        <input type="number" class="form-control" id="af-duration" placeholder="Ex: 15">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input type="text" class="form-control" id="af-title" placeholder="Descreva a atividade...">
    </div>
    <div class="form-group">
      <label class="form-label">Resultado / Outcome</label>
      <textarea class="form-control" id="af-outcome" rows="2" placeholder="Como foi? Qual foi o resultado?"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitActivity('${leadId}')"><i class="fas fa-save"></i> Salvar</button>`);
}

async function submitActivity(leadId) {
  const data = {
    lead_id: leadId,
    type: document.getElementById('af-type').value,
    title: document.getElementById('af-title').value,
    outcome: document.getElementById('af-outcome').value,
    duration_minutes: parseInt(document.getElementById('af-duration').value) || null
  };
  if (!data.title) { toast('Título obrigatório', 'error'); return; }
  try {
    await CRM.post('/activities', data);
    toast('Atividade registrada!', 'success');
    closeModal();
    if (CRM.currentPage === 'activities') renderActivities();
  } catch (e) { toast(e.message, 'error'); }
}

// ATIVIDADES PAGE
async function renderActivities() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-phone-alt" style="color:var(--accent)"></i> Atividades</h1>
        <p class="page-subtitle">Histórico de interações com leads</p></div>
    </div>
    <div class="card" id="activities-container">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>`;
  
  try {
    const data = await CRM.get('/activities?limit=50');
    const acts = data.activities || [];
    const actIcons = { call: 'fa-phone', email: 'fa-envelope', meeting: 'fa-calendar', whatsapp: 'fa-whatsapp', pipeline_change: 'fa-exchange-alt', note: 'fa-sticky-note', proposal: 'fa-file-contract', follow_up: 'fa-redo', task: 'fa-tasks' };
    
    document.getElementById('activities-container').innerHTML = acts.length === 0 ?
      '<div class="empty-state"><i class="fas fa-history"></i><h3>Nenhuma atividade</h3></div>' :
      acts.map(a => `
        <div class="activity-item">
          <div class="activity-icon ${a.type}"><i class="fas ${actIcons[a.type] || 'fa-circle'}"></i></div>
          <div class="activity-content" style="flex:1">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="activity-title">${a.title}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${CRM.formatDateTime(a.created_at)}</div>
            </div>
            ${a.lead_name ? `<div style="font-size:12px;color:var(--accent);font-weight:500"><i class="fas fa-user" style="font-size:10px"></i> ${a.lead_name}</div>` : ''}
            ${a.outcome ? `<div class="activity-outcome">"${a.outcome}"</div>` : ''}
            <div class="activity-time">${a.user_name}</div>
          </div>
        </div>`).join('');
  } catch (e) {
    document.getElementById('activities-container').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${e.message}</p></div>`;
  }
}

// TAREFAS
async function renderTasks() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-tasks" style="color:var(--accent)"></i> Tarefas & Compromissos</h1>
        <p class="page-subtitle">Gerencie suas tarefas e lembretes</p></div>
      <button class="btn btn-primary" onclick="showAddTaskModal()"><i class="fas fa-plus"></i> Nova Tarefa</button>
    </div>
    
    <div class="grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-clock" style="color:var(--warning)"></i> Pendentes</div></div>
        <div id="tasks-pending"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-check-circle" style="color:var(--success)"></i> Concluídas</div></div>
        <div id="tasks-completed"></div>
      </div>
    </div>`;
  
  await loadTasks();
}

async function loadTasks() {
  try {
    const [pending, completed] = await Promise.all([
      CRM.get('/tasks?status=pending'),
      CRM.get('/tasks?status=completed')
    ]);
    
    const renderTask = (t, done) => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--card-border)">
        <div class="stat-icon ${t.priority==='urgent'||t.priority==='high'?'red':t.priority==='medium'?'orange':'green'}" style="width:32px;height:32px;font-size:11px;flex-shrink:0">
          <i class="fas fa-${t.type==='call'?'phone':t.type==='meeting'?'calendar':'tasks'}"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;${done?'text-decoration:line-through;opacity:0.6':''}">${t.title}</div>
          ${t.description ? `<div style="font-size:11px;color:var(--text-secondary)">${t.description}</div>` : ''}
          ${t.lead_name ? `<div style="font-size:11px;color:var(--accent)"><i class="fas fa-user" style="font-size:10px"></i> ${t.lead_name}</div>` : ''}
          <div style="font-size:11px;color:${new Date(t.due_date) < new Date() && !done ? '#ef4444' : 'var(--text-secondary)'}">
            <i class="fas fa-calendar" style="font-size:10px"></i> ${CRM.formatDateTime(t.due_date)}
          </div>
        </div>
        ${!done ? `<button class="btn btn-sm btn-success" onclick="completeTask('${t.id}',this)"><i class="fas fa-check"></i></button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteTask('${t.id}',this)"><i class="fas fa-trash"></i></button>
      </div>`;
    
    const pendingEl = document.getElementById('tasks-pending');
    const completedEl = document.getElementById('tasks-completed');
    
    if (pendingEl) pendingEl.innerHTML = (pending.tasks || []).length === 0 ?
      '<div class="empty-state" style="padding:24px"><i class="fas fa-check-circle"></i><p>Sem pendências!</p></div>' :
      (pending.tasks || []).map(t => renderTask(t, false)).join('');
    
    if (completedEl) completedEl.innerHTML = (completed.tasks || []).slice(0, 5).length === 0 ?
      '<div class="empty-state" style="padding:24px"><i class="fas fa-tasks"></i><p>Nenhuma concluída</p></div>' :
      (completed.tasks || []).slice(0, 5).map(t => renderTask(t, true)).join('');
  } catch (e) {}
}

function showAddTaskModal() {
  showModal('Nova Tarefa', `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-control" id="tf-type">
          <option value="task">Tarefa</option>
          <option value="call">Ligação</option>
          <option value="meeting">Reunião</option>
          <option value="follow_up">Follow-up</option>
          <option value="reminder">Lembrete</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Prioridade</label>
        <select class="form-control" id="tf-priority">
          <option value="low">Baixa</option>
          <option value="medium" selected>Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Título *</label>
      <input type="text" class="form-control" id="tf-title" placeholder="Descreva a tarefa...">
    </div>
    <div class="form-group">
      <label class="form-label">Descrição</label>
      <textarea class="form-control" id="tf-desc" rows="2"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Data/Hora *</label>
      <input type="datetime-local" class="form-control" id="tf-due">
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitTask()"><i class="fas fa-save"></i> Salvar</button>`);
}

async function submitTask() {
  const data = {
    title: document.getElementById('tf-title').value,
    description: document.getElementById('tf-desc').value,
    due_date: document.getElementById('tf-due').value,
    priority: document.getElementById('tf-priority').value,
    type: document.getElementById('tf-type').value
  };
  if (!data.title || !data.due_date) { toast('Título e data são obrigatórios', 'error'); return; }
  try {
    await CRM.post('/tasks', data);
    toast('Tarefa criada!', 'success');
    closeModal();
    if (CRM.currentPage === 'tasks') loadTasks();
    if (CRM.currentPage === 'dashboard') renderDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

async function completeTask(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await CRM.patch(`/tasks/${id}/complete`, {});
    toast('Tarefa concluída!', 'success');
    if (CRM.currentPage === 'tasks') loadTasks();
    else if (CRM.currentPage === 'dashboard') renderDashboard();
  } catch (e) { toast(e.message, 'error'); if (btn) btn.disabled = false; }
}

async function deleteTask(id, btn) {
  if (btn) btn.disabled = true;
  try {
    await CRM.delete(`/tasks/${id}`);
    toast('Tarefa removida', 'info');
    loadTasks();
  } catch (e) { toast(e.message, 'error'); }
}

// PROPOSTAS
async function renderProposals() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title"><i class="fas fa-file-contract" style="color:var(--accent)"></i> Propostas</h1>
        <p class="page-subtitle">Gerencie propostas enviadas aos leads</p></div>
      <button class="btn btn-primary" onclick="showAddProposalModal()"><i class="fas fa-plus"></i> Nova Proposta</button>
    </div>
    <div class="card" id="proposals-container">
      <div class="loading-overlay"><div class="spinner"></div></div>
    </div>`;
  
  try {
    const data = await CRM.get('/proposals');
    const props = data.proposals || [];
    const statusColors = { draft: 'secondary', sent: 'info', accepted: 'success', rejected: 'danger', expired: 'warning' };
    const statusLabels = { draft: 'Rascunho', sent: 'Enviada', accepted: 'Aceita', rejected: 'Recusada', expired: 'Expirada' };
    
    document.getElementById('proposals-container').innerHTML = props.length === 0 ?
      '<div class="empty-state"><i class="fas fa-file-contract"></i><h3>Nenhuma proposta</h3></div>' :
      `<div class="table-container"><table>
        <thead><tr><th>Lead</th><th>Plano</th><th>Operadora</th><th>Valor/mês</th><th>Vidas</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
        <tbody>${props.map(p => `
          <tr>
            <td><div style="font-weight:600">${p.lead_name || '-'}</div><div style="font-size:11px;color:var(--text-secondary)">${p.user_name}</div></td>
            <td><div style="font-weight:500">${p.plan_name}</div><div style="font-size:11px;color:var(--text-secondary)">${p.title}</div></td>
            <td>${p.operator}</td>
            <td style="font-weight:700;color:var(--accent)">${CRM.formatMoney(p.monthly_value)}</td>
            <td>${p.lives_count}</td>
            <td><span class="badge badge-${statusColors[p.status]}">${statusLabels[p.status]}</span></td>
            <td style="font-size:12px">${CRM.formatDate(p.created_at)}</td>
            <td>
              <select class="form-control" style="font-size:11px;padding:4px 8px;width:auto" onchange="updateProposalStatus('${p.id}',this.value)">
                ${Object.entries(statusLabels).map(([k,v]) => `<option value="${k}" ${p.status===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  } catch (e) {
    document.getElementById('proposals-container').innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}

function showAddProposalModal() {
  showModal('Nova Proposta', `
    <div class="form-group">
      <label class="form-label">Lead (ID)</label>
      <input type="text" class="form-control" id="pf-lead-id" placeholder="ID do lead (ex: lead_abc123...)">
      <small style="color:var(--text-secondary)">Acesse o lead e copie o ID da URL</small>
    </div>
    <div class="form-group">
      <label class="form-label">Título da Proposta *</label>
      <input type="text" class="form-control" id="pf-title" placeholder="Ex: Proposta Bradesco Saúde - PF">
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label">Operadora *</label>
        <input type="text" class="form-control" id="pf-operator" placeholder="Bradesco, Unimed, SulAmérica...">
      </div>
      <div class="form-group">
        <label class="form-label">Nome do Plano *</label>
        <input type="text" class="form-control" id="pf-plan" placeholder="Ex: Plano Nacional Plus">
      </div>
    </div>
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-control" id="pf-plan-type">
          <option value="individual">Individual</option>
          <option value="familiar">Familiar</option>
          <option value="empresarial">Empresarial</option>
          <option value="adesao">Adesão</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Valor Mensal (R$) *</label>
        <input type="number" class="form-control" id="pf-value" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">Qtd. Vidas</label>
        <input type="number" class="form-control" id="pf-lives" value="1">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <textarea class="form-control" id="pf-notes" rows="2"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-primary" onclick="submitProposal()"><i class="fas fa-save"></i> Criar</button>`);
}

async function submitProposal() {
  const data = {
    lead_id: document.getElementById('pf-lead-id').value,
    title: document.getElementById('pf-title').value,
    operator: document.getElementById('pf-operator').value,
    plan_name: document.getElementById('pf-plan').value,
    plan_type: document.getElementById('pf-plan-type').value,
    monthly_value: parseFloat(document.getElementById('pf-value').value),
    lives_count: parseInt(document.getElementById('pf-lives').value) || 1,
    notes: document.getElementById('pf-notes').value
  };
  if (!data.lead_id || !data.title || !data.operator || !data.plan_name || !data.monthly_value) {
    toast('Preencha os campos obrigatórios', 'error'); return;
  }
  try {
    await CRM.post('/proposals', data);
    toast('Proposta criada!', 'success');
    closeModal();
    renderProposals();
  } catch (e) { toast(e.message, 'error'); }
}

async function updateProposalStatus(id, status) {
  try {
    await CRM.patch(`/proposals/${id}/status`, { status });
    toast('Status atualizado!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// UTILIDADES
function switchTab(e, tabId) {
  const container = e.target.closest('.modal-body, .tab-content, #page-content, .card') || document;
  
  // Desativar todos os tabs e conteúdos no mesmo nível
  e.target.closest('.tabs').querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  const parentModal = e.target.closest('.modal-body') || e.target.closest('#page-content') || document;
  parentModal.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  
  e.target.classList.add('active');
  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.add('active');
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function formatAIResponse(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*)/gm, '<h3>$1</h3>')
    .replace(/^## (.*)/gm, '<h2>$1</h2>')
    .replace(/^# (.*)/gm, '<h1>$1</h1>')
    .replace(/^- (.*)/gm, '• $1')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
