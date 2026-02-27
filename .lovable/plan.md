

# Gerenciamento de Usuários na Pagina de Configuracoes

## Funcionalidades a adicionar

1. **Alterar funcao (role)** do usuario diretamente na tabela
2. **Reenviar convite** para usuarios que ainda nao definiram senha
3. **Excluir usuario** com confirmacao via dialog

## Detalhes tecnicos

### 1. Edge function `manage-user`

Criar uma nova edge function `supabase/functions/manage-user/index.ts` que aceita 3 acoes via POST:

- `action: "update_role"` — Recebe `user_id` e `role`. Faz upsert na tabela `user_roles`.
- `action: "resend_invite"` — Recebe `user_id`. Busca o e-mail do usuario via `adminClient.auth.admin.getUserById()` e reenvia o convite com `adminClient.auth.admin.inviteUserByEmail()`.
- `action: "delete_user"` — Recebe `user_id`. Deleta o usuario via `adminClient.auth.admin.deleteUser()`. As tabelas `profiles` e `user_roles` serao limpas automaticamente pelo cascade ou precisarao de delete manual.

A funcao valida que o chamador e admin (mesmo padrao do `invite-user`). Impede que o admin exclua a si mesmo.

### 2. Atualizar `src/pages/Settings.tsx`

- Adicionar coluna "Acoes" na tabela de usuarios com:
  - **Select de role** inline para trocar entre viewer/admin (com mutation `update_role`)
  - **Botao "Reenviar convite"** (icone Mail) que chama mutation `resend_invite`
  - **Botao "Excluir"** (icone Trash) que abre um AlertDialog de confirmacao e chama mutation `delete_user`
- Impedir que o admin logado exclua ou rebaixe a si mesmo (desabilitar botoes para o proprio usuario)
- Adicionar imports de `AlertDialog`, `DropdownMenu`, `Mail`, `Trash2`, `MoreHorizontal`

### 3. Registrar a edge function

Adicionar entrada `[functions.manage-user]` com `verify_jwt = false` no `supabase/config.toml`.

### 4. Limpeza de dados ao excluir

Na edge function, antes de chamar `deleteUser`, deletar manualmente os registros de `user_roles` e `profiles` do usuario (ja que nao ha foreign key com cascade para `auth.users`).

