

# Integrar Google Analytics 4 (GA4)

## Visao geral
Criar a Edge Function `sync-google-analytics` que busca dados do GA4 usando a Google Analytics Data API v1 com autenticacao via Service Account, e grava na tabela `site_analytics` que ja existe.

## O que ja esta pronto
- Tabela `site_analytics` com colunas: date, sessions, users, new_users, pageviews, bounce_rate, avg_session_duration, top_pages, traffic_sources
- Registro `google_analytics` na tabela `integrations`
- Formulario de credenciais com campos `property_id` e `service_account_json`
- Card de integracao no frontend com icone e label
- Hook `useSiteAnalytics` para consumir dados no dashboard
- Grafico `SessionsByDayChart` ja renderizando dados da tabela

## O que sera feito

### 1. Criar Edge Function `supabase/functions/sync-google-analytics/index.ts`
Seguindo o mesmo padrao das funcoes existentes (sync-meta, sync-google-ads):

- Ler credenciais (`property_id` e `service_account_json`) da tabela `integrations`
- Gerar JWT a partir do Service Account JSON para obter access token do Google OAuth2
- Chamar a **Google Analytics Data API v1** (`analyticsdata.googleapis.com`) com endpoint `runReport`
- Buscar metricas dos ultimos 30 dias: sessions, users, new users, pageviews, bounce rate, avg session duration
- Fazer uma segunda chamada para top pages (dimensao: pagePath)
- Fazer uma terceira chamada para traffic sources (dimensao: sessionDefaultChannelGroup)
- Upsert dos dados na tabela `site_analytics`
- Atualizar status da integracao (syncing -> idle/error)

### 2. Atualizar `supabase/config.toml`
Adicionar configuracao para a nova funcao:
```toml
[functions.sync-google-analytics]
verify_jwt = false
```

### 3. Configurar cron job (pg_cron)
Adicionar agendamento de 15 minutos para a funcao, seguindo o padrao das demais integracoes.

## Detalhes tecnicos

### Autenticacao GA4 via Service Account
A API do GA4 usa OAuth2 com JWT assertion. O fluxo:
1. Parsear o JSON da Service Account para extrair `client_email` e `private_key`
2. Criar um JWT assinado com RS256 contendo `iss`, `scope` (analytics.readonly), `aud` (token endpoint), `iat`, `exp`
3. Trocar o JWT por access token via POST em `https://oauth2.googleapis.com/token`
4. Usar o access token para chamar a API

### Endpoint da API
```
POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
```

### Metricas solicitadas
- sessions, totalUsers, newUsers, screenPageViews, bounceRate, averageSessionDuration

### Upsert
Usar conflito na coluna `date` da tabela `site_analytics` para evitar duplicatas.

### Assinatura JWT em Deno
Usar a Web Crypto API nativa do Deno para importar a chave privada RSA e assinar o JWT, sem dependencias externas.
