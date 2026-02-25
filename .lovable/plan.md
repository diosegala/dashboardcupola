
# Fase 4 -- Pagina /integrations + Edge Function sync-sympla

## Resumo

Implementar a pagina completa de Integrações com cards de status para cada integração, formularios de credenciais mascarados, toggle ativar/desativar, botao "Sincronizar agora", e a Edge Function `sync-sympla` que usa o endpoint de **participantes** (cada participante = 1 ingresso vendido).

---

## 1. Secrets necessarios

Antes de iniciar, sera necessario configurar dois secrets no backend:

- **SYMPLA_API_TOKEN** -- o `s_token` da API Sympla
- **SYMPLA_EVENT_ID** -- o ID do evento no Sympla

Estes serao usados como fallback caso as credenciais nao estejam na tabela `integrations`. As credenciais na tabela `integrations` terao prioridade.

---

## 2. Pagina /integrations -- UI

### Estrutura de componentes

```text
src/pages/Integrations.tsx (reescrita completa)
src/components/integrations/IntegrationCard.tsx
src/components/integrations/CredentialsForm.tsx
src/hooks/useIntegrations.ts
```

### IntegrationCard

Cada card exibe:
- Nome e icone da integração (Sympla, Pipedrive, Meta Ads, Google Ads, RD Station, Google Analytics)
- Status badge: `idle` (cinza), `syncing` (amarelo pulsante), `error` (vermelho)
- `last_synced_at` formatado ("Ultima sync: ha X minutos")
- `error_message` em alerta vermelho quando presente
- Toggle Switch para `is_active`
- Botao "Sincronizar agora" (desabilitado se !is_active ou syncing)
- Botao "Configurar credenciais" que abre Dialog

### CredentialsForm (Dialog)

- Campos especificos por integração:
  - **Sympla**: api_token, event_id
  - **Pipedrive**: api_token, domain
  - **Meta Ads**: access_token, ad_account_id
  - **Google Ads**: client_id, client_secret, refresh_token, developer_token, customer_id
  - **RD Station**: client_id, client_secret, refresh_token
  - **Google Analytics**: property_id, service_account_json (textarea)
- Valores mascarados (exibe apenas "••••••••" para campos preenchidos)
- Botao "Revelar" para mostrar valor atual
- Submit salva no campo `credentials` (jsonb) da tabela `integrations`
- Apenas admins podem editar (verificar `isAdmin` do useAuth)

### useIntegrations hook

- Query para listar todas as integrações
- Mutation para update de `credentials`, `is_active`
- Mutation para acionar sync manual (chama a edge function)

### Controle de acesso

- Viewers verao os cards com status mas nao poderao editar credenciais, toggle ou sincronizar
- Botoes/forms desabilitados para viewers com tooltip explicativo

---

## 3. Edge Function: sync-sympla

### Arquivo

```text
supabase/functions/sync-sympla/index.ts
```

### Logica

1. Recebe POST (manual) ou e chamada por cron
2. Busca credenciais da tabela `integrations` onde `name = 'sympla'` e `is_active = true`
3. Se credenciais ausentes, tenta secrets `SYMPLA_API_TOKEN` e `SYMPLA_EVENT_ID` como fallback
4. Atualiza `sync_status = 'syncing'`
5. Chama `GET /events/{event_id}/participants` com header `s_token`
   - Paginacao: itera todas as paginas (`page=1`, `page_size=200`, ate `has_next=false`)
   - Cada participante retornado = 1 ingresso vendido
6. Para cada participante, faz upsert em `ticket_sales`:
   - `sympla_order_id` = `order_id` (chave de unicidade por `order_id + participant_id`)
   - `ticket_type` = `ticket_name` (ex: "VIP", "Pista")
   - `quantity` = 1 (cada participante e 1 ingresso)
   - `unit_price` = `ticket_sale_price`
   - `total_price` = `ticket_sale_price`
   - `buyer_name` = `first_name + " " + last_name`
   - `buyer_email` = `email`
   - `sold_at` = `order_approved_date` ou `order_date`
   - `status` = mapeado de `order_status` ("A" = "approved")
   - `event_id` = event_id das credenciais
7. Em sucesso: `sync_status = 'idle'`, `last_synced_at = now()`
8. Em erro: `sync_status = 'error'`, `error_message = mensagem`
9. Retry com exponential backoff (max 3 tentativas) para erros de rede/rate limit

### Unicidade

O `sympla_order_id` atual na tabela e unique. Como cada participante tem um `id` proprio e um `order_id`, usaremos o `id` do participante como `sympla_order_id` para garantir unicidade por ingresso (nao por pedido).

### CORS

Headers padrao para permitir chamadas do frontend.

### JWT

`verify_jwt = false` no config.toml, mas validacao manual de auth no codigo para chamadas manuais.

---

## 4. Chamada manual do frontend

O botao "Sincronizar agora" chama:
```typescript
supabase.functions.invoke('sync-sympla')
```

---

## 5. Migracao de banco

Nenhuma alteracao de schema necessaria -- as tabelas ja existem. Porem, e necessario adicionar permissao de INSERT/UPDATE na tabela `ticket_sales` para o service_role (usado pela Edge Function com `createClient` usando service role key). As Edge Functions usam o service_role_key internamente, que bypassa RLS, entao nao precisamos alterar politicas.

---

## Detalhes tecnicos

- A Edge Function usa `Deno.env.get("SUPABASE_URL")` e `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` para criar o client com permissoes de admin
- O campo `credentials` na tabela e jsonb -- para Sympla, armazena `{ api_token: "...", event_id: "..." }`
- A paginacao da Sympla API suporta ate `page_size=200`; a funcao itera ate `has_next=false`
- O toggle `is_active` e atualizado via `supabase.from("integrations").update({ is_active }).eq("id", id)` -- requer role admin (RLS ja configurado)
