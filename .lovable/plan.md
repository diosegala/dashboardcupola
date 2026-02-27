

# Corrigir erro 404 na integração Google Ads

## Problema
A Edge Function `sync-google-ads` obtém o access token com sucesso, mas recebe um **404 (Not Found)** ao chamar a Google Ads API. A URL usada e:
```
https://googleads.googleapis.com/v18/customers/6378725216/googleAds:searchStream
```

O 404 retorna uma pagina HTML generica do Google, o que indica que o endpoint nao existe mais.

## Causa provavel
A versao `v18` da API do Google Ads foi descontinuada. O Google remove versoes antigas periodicamente. A versao atual (fevereiro 2026) e provavelmente **v19** ou superior.

## Correcoes necessarias

### 1. Atualizar versao da API para v19
No arquivo `supabase/functions/sync-google-ads/index.ts`, alterar a URL de:
```
/v18/customers/${customerId}/googleAds:searchStream
```
para:
```
/v19/customers/${customerId}/googleAds:searchStream
```

### 2. Adicionar suporte a conta MCC (login-customer-id)
Se a conta Google Ads e gerenciada por uma conta MCC (Manager Account), a API exige o header `login-customer-id`. Para cobrir esse caso:
- Adicionar um campo opcional `manager_customer_id` nas credenciais
- Incluir o header `login-customer-id` na requisicao quando presente

### 3. Melhorar log de erro
Adicionar log da URL completa antes da chamada para facilitar debug futuro.

## Detalhes tecnicos

Alteracoes no arquivo `supabase/functions/sync-google-ads/index.ts`:
- Linha da URL: trocar `v18` por `v19`
- Headers da requisicao: adicionar `login-customer-id` condicionalmente
- Ler campo `manager_customer_id` das credenciais (opcional)
- Adicionar `console.log` da URL de chamada

Nenhuma alteracao no frontend ou no banco de dados.
