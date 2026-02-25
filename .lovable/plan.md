

# Dashboard de Vendas e Marketing — Cupola Summit

## Visão Geral
Dashboard centralizado para monitoramento em tempo real de vendas (Sympla, Pipedrive) e marketing (Meta Ads, Google Ads, RD Station, Google Analytics), com métricas comparadas a metas configuráveis. Backend Supabase com sincronização automática via Edge Functions.

---

## Fase 1 — Fundação (Auth, DB, Layout)

### Autenticação
- Login com e-mail/senha via Supabase Auth
- Todas as rotas protegidas — redirecionar para `/login` se não autenticado
- Logout no header

### Modelo de Dados (Supabase)
- Tabela `profiles` (id, name, created_at) vinculada a `auth.users`
- Tabela `user_roles` com enum `admin | viewer` (seguindo boas práticas de segurança)
- Tabelas: `integrations`, `goals`, `ticket_sales`, `deals`, `ad_metrics`, `email_campaigns`, `site_analytics` — conforme PRD
- RLS em todas as tabelas: viewers só leem, admins leem e escrevem em `goals` e `integrations`

### Layout Global
- Sidebar persistente: Dashboard, Metas, Integrações
- Header com nome do usuário e botão de logout
- Skeleton loading states em todos os componentes

---

## Fase 2 — Página `/dashboard`

### Seção Vendas (Sympla + Pipedrive)
- **Cards com comparação a metas:**
  - Total de ingressos vendidos vs. meta
  - Receita total vs. meta
  - Ticket médio
  - Top 5 tipos de ingresso (ranking com badges)
- **Gráficos:**
  - Linha: ingressos vendidos por dia
  - Barras: ingressos por tipo de ingresso
- **Pipedrive:**
  - Deals ganhos vs. meta
  - Funil: deals por stage

### Seção Marketing
- **Cards por fonte com métrica vs. meta:**
  - Meta Ads: Impressões, Cliques, Gasto, CTR
  - Google Ads: Impressões, Cliques, Gasto, Conversões
  - RD Station: Campanhas enviadas, Taxa abertura, Taxa clique, Leads
  - Site: Sessões, Usuários, Novos usuários, Pageviews
- **Gráficos:**
  - Linha multi-série: cliques Meta + Google por dia
  - Linha: sessões do site por dia

### Comportamento Geral
- Seletor de período (padrão: mês atual) filtrando todos os dados
- Indicador visual em cada card: verde (≥100%), amarelo (≥70%), vermelho (<70%)
- Supabase Realtime para atualizar contadores automaticamente sem refresh

---

## Fase 3 — Página `/goals` (Metas)

- Formulário: metric_key (select com labels amigáveis), label, target_value, period_start, period_end
- Lista de metas com edição e exclusão inline
- Múltiplas metas por metric_key em períodos diferentes
- Dashboard usa a meta cujo período contém a data atual (mais recente se houver sobreposição)
- Sem meta configurada → exibir apenas valor atual, sem barra de progresso
- Apenas admins podem criar/editar/excluir metas

---

## Fase 4 — Página `/integrations` (Integrações)

- Card por integração com: nome, ícone, status (is_active, last_synced_at, sync_status, error_message)
- Formulário de credenciais específico por integração (Sympla, Pipedrive, Meta, Google Ads, RD Station, GA)
- Credenciais mascaradas (••••••••) com botão revelar/editar
- Botão "Sincronizar agora" para acionar Edge Function manualmente
- Toggle ativar/desativar integração
- Alertas visuais para credenciais inválidas ou erros de sincronização
- Apenas admins podem editar credenciais e configurar integrações

---

## Fase 5 — Edge Functions (Sincronização)

- Uma Edge Function por integração: `sync-sympla`, `sync-pipedrive`, `sync-meta`, `sync-google-ads`, `sync-rd-station`, `sync-ga`
- Cada função: busca credenciais da tabela `integrations`, faz upsert nos dados, atualiza status
- Cron jobs a cada 15 minutos + acionamento manual via botão
- Tratamento de erros: captura 401/403, grava `error_message`, retry com exponential backoff (máx 3 tentativas)
- Refresh automático de tokens OAuth quando possível; marca erro se falhar

---

## Casos Extremos Tratados
- Credenciais inválidas → alerta no card da integração
- Período sem dados → empty state nos cards/gráficos
- Sympla sem event_id → bloqueia sincronização com aviso
- Rate limit de APIs → retry com exponential backoff
- Viewer não edita metas nem credenciais (validação por role)

