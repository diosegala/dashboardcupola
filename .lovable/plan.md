

# Correção: Alterar nível de acesso de usuários

## Problema

O erro nos logs da edge function é claro:

```
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```

A tabela `user_roles` tem uma constraint unique em `(user_id, role)` (par composto), mas o código do `manage-user` faz upsert com `onConflict: "user_id"` (coluna única). O Postgres rejeita porque não existe constraint unique apenas em `user_id`.

## Solução

Duas mudanças:

### 1. Migration: adicionar constraint unique em `user_id`

Adicionar uma constraint unique apenas na coluna `user_id` da tabela `user_roles`. Isso garante que cada usuário tenha apenas uma role e permite o upsert funcionar.

```sql
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
```

### 2. Edge function `manage-user`: ajuste no upsert

Alterar o upsert para usar a nova constraint corretamente. O código atual já está correto em intenção (`onConflict: "user_id"`), então após a migration ele funcionará. Opcionalmente, podemos simplificar para delete+insert para maior robustez.

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar constraint `UNIQUE (user_id)` |
| `manage-user/index.ts` | (opcional) simplificar para delete+insert |

