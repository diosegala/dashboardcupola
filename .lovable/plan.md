

# Corrigir acesso admin nos cards de integração + fix sync-sympla

## Problema identificado

Os botões de toggle (ativo/inativo), "Credenciais" e "Sincronizar" ficam desabilitados porque a propriedade `isAdmin` retorna `false` no frontend, mesmo com o papel `admin` configurado corretamente no banco.

A causa mais provável é uma condição de corrida (race condition) no `useAuth`: a consulta ao `user_roles` pode falhar silenciosamente ou retornar `null` antes da sessão estar totalmente estabelecida, fazendo `isAdmin` permanecer `false`.

## Correções

### 1. Tornar a consulta de role mais robusta em `useAuth.tsx`

- Adicionar tratamento de erro na consulta ao `user_roles` (se a promise rejeitar, `isAdmin` fica `false` silenciosamente sem sequer tentar)
- Garantir que a consulta ao banco só executa depois que a sessão está confirmada (aguardar o `onAuthStateChange` antes de consultar roles)
- Adicionar um `console.log` temporario para debug do valor retornado pela query de role

### 2. Adicionar `.trim()` nos secrets da Edge Function `sync-sympla`

- Aplicar `.trim()` em `apiToken` e `eventId` para remover possíveis espaços/quebras de linha nos valores dos secrets
- Adicionar log do `eventId` e primeiros caracteres do token para diagnóstico

### 3. Redesplegar `sync-sympla`

- Deploy da função atualizada e teste via curl

## Detalhes técnicos

### Arquivo: `src/hooks/useAuth.tsx`

Alterar o `useEffect` que busca role para:
- Usar `try/catch` ao redor do `Promise.all`
- Logar resultado da query de roles no console para debugging
- Caso `profileRes` falhe, não bloquear a verificação de `isAdmin`

### Arquivo: `supabase/functions/sync-sympla/index.ts`

- Adicionar `.trim()` nos valores de `apiToken` e `eventId`
- Adicionar `console.log("Sync sympla - eventId:", eventId, "token prefix:", apiToken.slice(0,8))` para diagnóstico nos logs

### Nenhuma migração de banco necessária

O schema e as políticas RLS estão corretos. O problema é exclusivamente no frontend (race condition no carregamento do papel admin).

