
# Implementacao da Integracao Meta Ads

## Resumo
Criar a funcao backend `sync-meta` que busca metricas de campanhas da API do Meta Marketing e grava na tabela `ad_metrics` existente. A UI do dashboard (MarketingSection) ja exibe os dados filtrados por `source === "meta"`, entao basta popular a tabela.

## Pre-requisitos (credenciais)
Antes de implementar, sera necessario salvar as credenciais do Meta Ads pela tela de Integracoes do app (campos `access_token` e `ad_account_id` ja configurados no formulario). A funcao lera essas credenciais da tabela `integrations` (registro `name = 'meta'` ja existe).

## Etapas

### 1. Criar a Edge Function `sync-meta`
Arquivo: `supabase/functions/sync-meta/index.ts`

Seguindo o mesmo padrao do `sync-sympla`:
- CORS headers padrao
- Autenticacao opcional (manual trigger vs cron)
- Ler credenciais (`access_token`, `ad_account_id`) da tabela `integrations` (campo `credentials`)
- Atualizar `sync_status` para "syncing"
- Chamar a **Meta Marketing API v22.0**:
  - Endpoint: `https://graph.facebook.com/v22.0/{ad_account_id}/insights`
  - Parametros: `fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm,conversions&level=adset&time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}&time_increment=1`
  - Buscar ultimos 30 dias de dados
  - Paginar usando cursor (`after`)
- Mapear e upsert na tabela `ad_metrics` com `source = 'meta'`
  - Conflito por combinacao `source + date + ad_set_id` (necessario criar indice unico)
- Atualizar `sync_status` para "idle" com `last_synced_at`
- Tratamento de erros com retry (reutilizar padrao do sympla)

### 2. Criar indice unico na tabela `ad_metrics`
Migracao SQL para adicionar um indice unico que permita upsert sem duplicatas:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS ad_metrics_source_date_adset
ON ad_metrics (source, date, COALESCE(ad_set_id, ''));
```
Tambem adicionar policy de INSERT/UPDATE para o service role (via RLS bypass, ja que a funcao usa service_role_key).

### 3. Atualizar `supabase/config.toml`
Adicionar configuracao da nova funcao:
```toml
[functions.sync-meta]
verify_jwt = false
```

### 4. Configurar cron job para sincronizacao automatica
SQL para agendar execucao a cada 15 minutos (mesmo padrao do sympla):
```sql
SELECT cron.schedule(
  'sync-meta-every-15min',
  '*/15 * * * *',
  $$ SELECT net.http_post(...) $$
);
```

### 5. Nenhuma mudanca necessaria no frontend
- O `MarketingSection` ja filtra `adMetrics` por `source === "meta"` e exibe impressoes, cliques, gasto e CTR
- O `ClicksByDayChart` ja renderiza dados de meta
- O `IntegrationCard` e `CredentialsForm` ja suportam a integracao "meta" com os campos `access_token` e `ad_account_id`
- O botao "Sincronizar" ja chama `sync-meta` via `supabase.functions.invoke`

## Detalhes Tecnicos

A Edge Function fara requests para:
```
GET https://graph.facebook.com/v22.0/{act_XXXX}/insights
  ?fields=campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,cpm
  &level=adset
  &time_increment=1
  &time_range={"since":"2026-01-27","until":"2026-02-26"}
  &limit=500
```

O mapeamento para `ad_metrics`:
| Meta API | ad_metrics |
|----------|------------|
| campaign_id | campaign_id |
| campaign_name | campaign_name |
| adset_id | ad_set_id |
| adset_name | ad_set_name |
| impressions | impressions |
| clicks | clicks |
| spend | spend |
| ctr | ctr |
| cpc | cpc |
| cpm | cpm |
| date_start | date |
| - | source = "meta" |
