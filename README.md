# [SUM] Dashboard de vendas e Marketing

PRD — Dashboard de Vendas e Marketing | CUPOLA Summit

Visão Geral

Dashboard centralizado para monitoramento em tempo real de vendas (Sympla, Pipedrive) e marketing (Meta Ads, Google Ads, RD Station, Google Analytics). Todas as métricas são exibidas em comparação com metas configuráveis. Backend: Supabase. UI: shadcn/ui.

Stack & Configuração Inicial

Backend: Supabase (Auth, PostgreSQL, Realtime, Edge Functions)

UI Components: shadcn/ui

Autenticação: Supabase Auth com e-mail/senha. Proteger todas as rotas. Redirecionar para /login se não autenticado.

Realtime: Supabase Realtime subscriptions em todas as tabelas de métricas. Dados devem atualizar automaticamente sem refresh manual.

Sincronização: Edge Functions acionadas por cron jobs a cada 15 minutos para buscar dados de cada integração e upsert no banco.

Modelo de Dados

users

Gerenciado pelo Supabase Auth. Campos adicionais em profiles:

profiles: id (uuid, FK auth.users), name (text), role (text: admin|viewer), created_at


integrations

id, name (text: sympla|pipedrive|meta|google_ads|rd_station|google_analytics),
is_active (bool), credentials (jsonb, encrypted), last_synced_at (timestamptz),
sync_status (text: idle|syncing|error), error_message (text), created_at, updated_at


goals

id, metric_key (text), label (text), target_value (numeric),
period_start (date), period_end (date), created_by (uuid FK profiles), created_at, updated_at


metric_key examples: tickets_sold, revenue, leads, site_visits, meta_impressions, meta_clicks, google_impressions, google_clicks, email_open_rate, email_click_rate

ticket_sales (Sympla)

id, sympla_order_id (text, unique), event_id (text), ticket_type (text),
ticket_type_id (text), quantity (int), unit_price (numeric), total_price (numeric),
buyer_name (text), buyer_email (text), status (text), sold_at (timestamptz),
synced_at (timestamptz)


deals (Pipedrive)

id, pipedrive_deal_id (text, unique), title (text), value (numeric),
currency (text), stage_id (text), stage_name (text), status (text: open|won|lost),
owner_name (text), created_at_source (timestamptz), won_at (timestamptz),
lost_at (timestamptz), synced_at (timestamptz)


ad_metrics (Meta + Google Ads)

id, source (text: meta|google_ads), campaign_id (text), campaign_name (text),
ad_set_id (text), ad_set_name (text), date (date), impressions (int),
clicks (int), spend (numeric), conversions (int), ctr (numeric),
cpc (numeric), cpm (numeric), synced_at (timestamptz)
UNIQUE(source, campaign_id, ad_set_id, date)


email_campaigns (RD Station)

id, rd_campaign_id (text, unique), name (text), subject (text),
sent_at (timestamptz), total_sent (int), total_opened (int), total_clicked (int),
open_rate (numeric), click_rate (numeric), unsubscribes (int), synced_at (timestamptz)


site_analytics (Google Analytics)

id, date (date, unique), sessions (int), users (int), new_users (int),
pageviews (int), bounce_rate (numeric), avg_session_duration (numeric),
top_pages (jsonb), traffic_sources (jsonb), synced_at (timestamptz)


Páginas & Funcionalidades

Layout Global

Sidebar persistente com navegação: Dashboard, Metas, Integrações

Header com nome do usuário e botão de logout

Todas as páginas protegidas por autenticação

/dashboard

Seção Vendas (Sympla + Pipedrive)

Cards:

Total de ingressos vendidos vs. meta (tickets_sold)

Receita total de ingressos vs. meta (revenue)

Ticket médio

Top 5 tipos de ingresso mais vendidos (ranking com badge de quantidade)

Gráficos:

Linha: ingressos vendidos por dia (histórico completo do evento, agrupado por sold_at::date)

Barras: ingressos por tipo (ticket_type)

Pipedrive:

Deals ganhos no período vs. meta

Funil: contagem de deals por stage_name

Seção Marketing

Cards por fonte (Meta, Google Ads, RD Station, Site), cada um mostrando métrica principal vs. meta:

Meta Ads: Impressões, Cliques, Gasto, CTR

Google Ads: Impressões, Cliques, Gasto, Conversões

RD Station: Campanhas enviadas, Taxa de abertura, Taxa de clique, Leads gerados

Site: Sessões, Usuários, Novos usuários, Pageviews

Gráficos:

Linha multi-série: cliques Meta + Google por dia no período selecionado

Linha: sessões do site por dia

Comportamento Geral do Dashboard:

Seletor de período (padrão: mês atual). Filtrar todos os dados pelo período.

Cada card de métrica exibe: valor atual, valor da meta, percentual atingido, indicador visual (verde ≥100%, amarelo ≥70%, vermelho <70%)

Realtime: subscribe nas tabelas ticket_sales, ad_metrics, email_campaigns, site_analytics para atualizar contadores automaticamente

/goals — Configuração de Metas

Entrada: Formulário com campos: metric_key (select com labels amigáveis), label (texto livre), target_value (número), period_start (date), period_end (date)

Saída: Lista de metas cadastradas com edição e exclusão inline

Regras:

Pode existir múltiplas metas para o mesmo metric_key em períodos diferentes

Ao exibir no dashboard, usar a meta cujo período contém a data atual

Se não houver meta configurada, exibir card sem comparação (apenas valor atual)

/integrations — Configuração de Integrações

Para cada integração (sympla, pipedrive, meta, google_ads, rd_station, google_analytics):

Exibir card com:

Nome e ícone da integração

Status: is_active, last_synced_at, sync_status, error_message

Formulário para inserir/atualizar credenciais (campos específicos por integração, listados abaixo)

Botão "Sincronizar agora" — aciona Edge Function manualmente

Toggle para ativar/desativar

Campos de credenciais por integração:

Sympla: api_token, event_id

Pipedrive: api_token, domain

Meta Ads: access_token, ad_account_id

Google Ads: client_id, client_secret, refresh_token, developer_token, customer_id

RD Station: client_id, client_secret, refresh_token

Google Analytics: property_id, service_account_json (textarea)

Segurança: Credenciais salvas como jsonb na coluna credentials. Nunca exibir valores salvos em texto claro — mostrar apenas •••••••• com botão para revelar/editar.

Edge Functions (Supabase)

Criar uma Edge Function por integração:

Função Trigger Ação sync-sympla cron 15min + manual GET /events/{event_id}/orders, upsert em ticket_sales sync-pipedrive cron 15min + manual GET /deals, upsert em deals sync-meta cron 15min + manual GET Insights API por campaign/adset/dia, upsert em ad_metrics sync-google-ads cron 15min + manual GAQL query por campaign/adgroup/dia, upsert em ad_metrics sync-rd-station cron 15min + manual GET /emails, upsert em email_campaigns sync-ga cron 15min + manual GA4 Data API por data, upsert em site_analytics

Cada função deve:

Buscar credenciais da tabela integrations onde name = [fonte] e is_active = true

Atualizar sync_status = 'syncing' antes de iniciar

Em sucesso: sync_status = 'idle', last_synced_at = now()

Em erro: sync_status = 'error', error_message = [mensagem]

Casos Extremos

Credenciais inválidas: Edge Function captura erro 401/403, grava error_message, exibe alerta no card da integração

Meta sem configuração: Exibir valor atual sem barra de progresso

Período sem dados: Exibir zero com estado vazio (empty state) no card/gráfico

Múltiplas metas no mesmo período: Usar a mais recente (created_at DESC)

Token expirado (OAuth): Edge Function tenta refresh via refresh_token; se falhar, marca integração como erro e notifica via error_message

Usuário viewer: Pode visualizar dashboard e metas, mas não pode editar metas nem credenciais (validar via role em profiles)

Sympla sem event_id: Bloquear sincronização e exibir aviso na tela de integrações

Rate limit de APIs: Implementar retry com exponential backoff (máx 3 tentativas) nas Edge Functions

Estilização

Usar shadcn/ui para todos os componentes (Card, Table, Button, Input, Select, Badge, Switch, Dialog, Separator, Skeleton para loading states). Aplicar dados de estilização fornecidos pelo usuário no sistema de design (cores, tipografia, espaçamentos). Usar Recharts (já incluso no shadcn) para todos os gráficos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dashboardcupola.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d5769655-3510-47b4-abd2-cfc2f9f77e0f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
