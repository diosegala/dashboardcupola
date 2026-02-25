

# Corrigir versao da API Sympla + acesso admin nos cards

## Problema principal

A Edge Function `sync-sympla` usa a URL base `https://api.sympla.com.br/public/v3/` mas a documentacao oficial da Sympla indica que a versao correta e **v1.5.1** (`https://api.sympla.com.br/public/v1.5.1/`). Isso causa o erro "Event not found" (code 11) porque a v3 nao reconhece o event_id.

## Problema secundario

Os botoes de toggle, credenciais e sincronizar ficam desabilitados no frontend porque `isAdmin` pode retornar `false` devido a uma race condition no `useAuth.tsx`.

## Correcoes

### 1. Atualizar URL base da API Sympla na Edge Function

No arquivo `supabase/functions/sync-sympla/index.ts`, alterar a URL de:
```
https://api.sympla.com.br/public/v3/events/${eventId}/participants
```
Para:
```
https://api.sympla.com.br/public/v1.5.1/events/${eventId}/participants
```

Tambem adicionar log da URL completa para facilitar debug futuro.

### 2. Verificar e corrigir `useAuth.tsx`

Verificar o estado atual do hook `useAuth` para garantir que a consulta de role e robusta e nao falha silenciosamente. Os logs do console ja mostram `roleRes: {"data":{"role":"admin"}}`, entao o backend esta correto. Se `isAdmin` ainda retorna `false` na UI, o problema esta em como o estado e propagado apos o fetch.

### 3. Redesplegar e testar

- Deploy da funcao atualizada
- Teste via curl para confirmar que a sincronizacao funciona com a v1.5.1

## Detalhes tecnicos

### Arquivo: `supabase/functions/sync-sympla/index.ts`
- Linha 79: trocar `v3` por `v1.5.1` na URL base
- Adicionar log da URL completa sendo chamada

### Arquivo: `src/hooks/useAuth.tsx`
- Investigar se `isAdmin` esta sendo setado corretamente apos o fetch da role (os logs mostram que o fetch retorna `admin`, mas a UI pode nao estar reagindo)

### Nenhuma migracao de banco necessaria

