# CRM Saúde PRO

## Visão Geral
**CRM Saúde PRO** é uma plataforma completa de gestão comercial focada em corretagem de planos de saúde (PF, PME e Adesão), com IA integrada via OpenAI, pipeline Kanban, relatórios e gestão completa de leads.

---

## 🔐 Credenciais de Acesso

| Cargo | E-mail | Senha |
|-------|--------|-------|
| **Administrador** | admin@crmsaudepro.com | admin123 |
| **Diretor** | gabriel.comercialtopprime@gmail.com | *G19g2704 |

---

## ✅ Funcionalidades Implementadas

### Dashboard
- Saudação personalizada (Bom dia/tarde/noite + nome do usuário)
- Relógio em tempo real + data completa
- Cards de métricas (Total leads, ganhos, receita, tarefas)
- Funil de vendas por tipo (PF, PME, Adesão)
- Gráfico do pipeline de vendas
- Leads recentes e atividades recentes
- Tarefas pendentes com ação rápida

### Pipeline Kanban
- Drag-and-drop para mover leads entre estágios
- 7 estágios: Novo Lead → 1º Contato → Qualificação → Proposta → Negociação → Ganho/Perdido
- Filtros por tipo e busca em tempo real
- Histórico de movimentações

### Gestão de Leads
- Tipos: Pessoa Física (PF), PME/Empresarial, Adesão
- Formulário completo com 3 abas (Dados, Comercial, Endereço)
- Detalhes do lead com atividades, propostas e histórico
- Análise de lead com IA
- Filtros avançados e busca

### Atividades
- Tipos: Ligação, WhatsApp, E-mail, Reunião, Nota, Follow-up, Proposta
- Histórico completo vinculado a leads
- Timeline visual com ícones por tipo

### Tarefas & Compromissos
- CRUD completo de tarefas
- Prioridades: Baixa/Média/Alta/Urgente
- Tipos: Tarefa, Ligação, Reunião, Follow-up, Lembrete
- Destaque visual para tarefas vencidas

### Propostas
- Cadastro de propostas por lead
- Status: Rascunho, Enviada, Aceita, Recusada, Expirada
- Dados completos: operadora, plano, valor, vidas

### IA Assistente (OpenAI GPT-4o-mini)
- **Chat geral** com contexto de planos de saúde
- **Gerador de scripts** de vendas personalizados
- **Superação de objeções** com respostas contextualizadas
- **Análise de leads** com insights detalhados
- **Relatórios inteligentes** gerados com IA
- Histórico de conversas por sessão

### Relatórios
- Relatório de performance por período
- Gráficos de pizza (por tipo e por estágio)
- Relatório inteligente com análise IA
- Histórico de relatórios gerados

### Gestão de Usuários (ADM)
- CRUD completo de usuários
- 4 níveis de acesso com permissões específicas
- Ativar/Desativar usuários
- Redefinição de senha pelo ADM

### Configurações
- Perfil do usuário (nome, telefone, senha)
- Tema claro/escuro por usuário
- Toggle da barra lateral
- Informações do sistema

---

## 🎨 Design & UX

- **Cores**: Azul escuro (#1e3a5f) + Branco
- **Modo claro e escuro** configurável por usuário
- **Barra lateral recolhível** com tooltips no modo colapsado
- **Animações suaves** em modais, toasts e transições
- **Responsivo** para dispositivos móveis

---

## 🛡️ Permissões por Cargo

| Função | Admin | Diretor | Gerente | Corretor |
|--------|-------|---------|---------|----------|
| Dashboard completo | ✅ | ✅ | ✅ | Próprio |
| Ver todos os leads | ✅ | ✅ | ✅ | ❌ |
| Criar leads | ✅ | ✅ | ✅ | ✅ |
| Mover pipeline | ✅ | ✅ | ✅ | ✅ |
| Relatórios completos | ✅ | ✅ | ✅ | Próprios |
| Gerenciar usuários | ✅ | ❌ | ❌ | ❌ |
| IA Assistente | ✅ | ✅ | ✅ | ✅ |
| Excluir leads | ✅ | ✅ | ✅ | ❌ |

---

## 🗄️ Banco de Dados (Cloudflare D1 / SQLite)

### Tabelas
- `users` - Usuários com roles e configurações
- `leads` - Leads PF/PME/Adesão com dados completos
- `activities` - Histórico de atividades por lead
- `tasks` - Tarefas e compromissos
- `proposals` - Propostas vinculadas a leads
- `reports` - Relatórios gerados
- `ai_conversations` - Histórico de conversas IA
- `notifications` - Notificações do sistema
- `pipeline_history` - Histórico de movimentações do pipeline

---

## 🚀 Deploy via Cloudflare Pages

### Pré-requisitos
1. Conta na Cloudflare
2. API Key do OpenAI (para IA funcionar)
3. Wrangler CLI instalado

### Passos para Deploy

```bash
# 1. Instalar dependências
npm install

# 2. Login no Cloudflare
npx wrangler login

# 3. Criar banco de dados D1 na Cloudflare
npx wrangler d1 create crm-saude-pro-production
# Copiar o database_id gerado para wrangler.jsonc

# 4. Atualizar wrangler.jsonc com o database_id real
# (substituir "placeholder-will-be-replaced-on-deploy" pelo ID gerado)

# 5. Criar projeto no Cloudflare Pages
npx wrangler pages project create crm-saude-pro --production-branch main

# 6. Aplicar migrations no banco de produção
npx wrangler d1 migrations apply crm-saude-pro-production

# 7. Build e deploy
npm run build
npx wrangler pages deploy dist --project-name crm-saude-pro

# 8. Configurar variáveis de ambiente (OBRIGATÓRIO para IA)
npx wrangler pages secret put OPENAI_API_KEY --project-name crm-saude-pro
npx wrangler pages secret put JWT_SECRET --project-name crm-saude-pro
```

### Desenvolvimento Local (VS Code)
```bash
# Instalar dependências
npm install

# Criar banco de dados local e aplicar seed
npm run db:reset

# Iniciar servidor de desenvolvimento
npm run dev:d1
# Acessa em: http://localhost:3000
```

---

## 🤖 Configuração da IA (OpenAI)

A IA usa diretamente a API da **OpenAI** (sem vínculo com Genspark).

1. Acesse https://platform.openai.com/api-keys
2. Crie uma nova API Key
3. **Para produção**: Configure como secret no Cloudflare
4. **Para desenvolvimento local**: Adicione no arquivo `.dev.vars`:
   ```
   OPENAI_API_KEY=sk-sua-chave-aqui
   ```

---

## 📁 Estrutura do Projeto

```
webapp/
├── src/
│   ├── index.tsx              # Entry point Hono + HTML SPA
│   ├── routes/
│   │   ├── auth.ts            # Login, perfil, tema
│   │   ├── users.ts           # CRUD usuários (admin)
│   │   ├── leads.ts           # CRUD leads + pipeline
│   │   ├── activities.ts      # Atividades
│   │   ├── tasks.ts           # Tarefas
│   │   ├── proposals.ts       # Propostas
│   │   ├── reports.ts         # Relatórios + dashboard
│   │   ├── ai.ts              # IA OpenAI (sem Genspark)
│   │   └── notifications.ts   # Notificações
│   ├── middleware/
│   │   └── auth.ts            # JWT middleware
│   └── utils/
│       └── auth.ts            # JWT, hash, helpers
├── public/
│   └── static/
│       ├── app.js             # Core CRM (auth, nav, sidebar)
│       ├── pages.js           # Pipeline, Leads, Tarefas...
│       ├── pages2.js          # Relatórios, IA, Usuários, Config
│       └── styles.css         # Estilos globais (light/dark)
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_users.sql
├── wrangler.jsonc             # Config Cloudflare
├── ecosystem.config.cjs       # PM2 config
└── package.json
```

---

## 📊 URLs da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Dados do usuário |
| GET | /api/leads | Listar leads |
| POST | /api/leads | Criar lead |
| PATCH | /api/leads/:id/stage | Mover no pipeline |
| GET | /api/reports/dashboard | Dados do dashboard |
| POST | /api/ai/chat | Chat com IA |
| POST | /api/ai/script | Gerar script |
| POST | /api/ai/analyze-lead | Analisar lead |
| POST | /api/ai/objections | Superar objeções |
| GET | /api/users | Listar usuários |
| POST | /api/users | Criar usuário |

---

## 📌 Status
- **Versão**: 1.0.0
- **Plataforma**: Cloudflare Pages + D1
- **Status**: ✅ Funcional e pronto para deploy
- **IA**: OpenAI GPT-4o-mini (direto, sem intermediários)
- **Última atualização**: 2026-03-11
