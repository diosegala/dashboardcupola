

# Exibir status de confirmação e último login dos usuários

## Problema

Os dados de confirmação de conta (`email_confirmed_at`) e último login (`last_sign_in_at`) ficam na tabela `auth.users`, que não é acessível pelo cliente. Atualmente a página de Configurações só mostra nome, função e data de criação do perfil.

## Solução

Criar uma nova action `list_users` na edge function `manage-user` que usa o `auth.admin.listUsers()` para retornar esses dados. O frontend consome essa action e exibe duas novas colunas na tabela.

```text
Tabela atual:                    Tabela nova:
Nome | Função | Desde | Ações    Nome | Função | Status | Último login | Desde | Ações
                                              ✓ Ativo    16/03/2026
                                              ⏳ Pendente  —
```

## Alterações

### `supabase/functions/manage-user/index.ts`

- Nova action `list_users` (só para admins, mesmo padrão das outras actions)
- Chama `adminClient.auth.admin.listUsers()` e retorna para cada usuário: `id`, `email`, `email_confirmed_at`, `last_sign_in_at`

### `src/pages/Settings.tsx`

- O hook `useUsers` passa a chamar a edge function `manage-user` com `action: "list_users"` para obter os dados de auth, e faz merge com profiles/roles
- Duas novas colunas na tabela:
  - **Status**: Badge "Ativo" (verde) se `email_confirmed_at` existe, "Pendente" (amarelo) se não
  - **Último login**: data formatada de `last_sign_in_at`, ou "—" se nunca logou

