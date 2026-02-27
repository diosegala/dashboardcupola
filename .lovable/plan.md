

# Implementação da Integração Google Ads

## Resumo
Criar a Edge Function `sync-google-ads` que autentica via OAuth2, busca métricas da API do Google Ads e grava na tabela `ad_metrics` com `source = 'google_ads'`. Também corrigir o mapeamento de nome no hook para que o botão "Sincronizar" funcione corretamente.

## Etapas

### 1. Criar Edge Function `sync-google-ads`
Arquivo: `supabase/functions/sync-google-ads/index.ts`

Seguindo o padrão do `sync-meta`:
- Ler credenciais (`client_id`, `client_secret`, `refresh_token`, `developer_token`, `customer_id`) da tabela `integrations`
- Obter access_token via OAuth2 refresh (POST `https://oauth2.googleapis.com/token`)
- Chamar Google Ads REST API v18 (`searchStream`) com GAQL query para últimos 30 dias no nível ad_group
- Converter `cost_micros`, `average_cpc`, `average_cpm` dividindo por 1.000.000
- Upsert na `ad_metrics` com `source = 'google_ads'`
- Retry com backoff exponencial
- Atualizar `sync_status` e `last_synced_at`

### 2. Corrigir mapeamento de nome no hook
Arquivo: `src/hooks/useIntegrations.ts`

O hook monta `sync-${name}`, que para `google_ads` gera `sync-google_ads` (com underscore). A Edge Function se chama `sync-google-ads` (com hífen). Correção:
```typescript
const fnName = `sync-${name.replace(/_/g, "-")}`;
```

### 3. Configurar cron job (15 min)
Migração SQL para agendar `sync-google-ads` a cada 15 minutos via `cron.schedule` + `net.http_post`.

### 4. Nenhuma outra mudança no frontend
- MarketingSection já exibe dados de `source === "google_ads"` (Impressões, Cliques, Gasto, Conversões)
- CredentialsForm já tem os 5 campos configurados
- IntegrationCard já suporta a integração

## Credenciais necessárias (já orientado acima)
1. Developer Token - Centro de API do Google Ads
2. Customer ID - número XXX-XXX-XXXX do Google Ads (sem hífens)
3. Client ID e Client Secret - Google Cloud Console, credenciais OAuth 2.0
4. Refresh Token - via OAuth 2.0 Playground com scope `https://www.googleapis.com/auth/adwords`

