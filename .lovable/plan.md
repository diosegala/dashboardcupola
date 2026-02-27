

# Pagina de Configuracoes com Gerenciamento de Usuarios

## Resumo
Criar uma pagina `/settings` acessivel apenas para admins, onde sera possivel convidar novos usuarios e visualizar os usuarios existentes. O cadastro sera restrito a e-mails com dominio `@cupola.com.br`.

## Backend: Edge Function para convite de usuarios

Criar uma edge function `invite-user` que:
1. Verifica se o usuario logado e admin (via `has_role`)
2. Valida que o e-mail termina com `@cupola.com.br`
3. Usa o Supabase Admin API (`auth.admin.inviteUserByEmail`) para enviar o convite
4. Opcionalmente atribui a role `viewer` ao novo usuario

Isso garante que a validacao de dominio acontece no servidor, sem possibilidade de bypass pelo client.

## Frontend

### Nova pagina `src/pages/Settings.tsx`
- Formulario para convidar usuario: campo de e-mail + selecao de role (admin/viewer) + botao "Convidar"
- Validacao client-side do dominio `@cupola.com.br` antes de enviar
- Lista de usuarios existentes (consulta `profiles` + `user_roles`)
- Restrita a admins (verificacao via `isAdmin` do `useAuth`)

### Atualizacoes na navegacao
- Adicionar item "Configuracoes" no `AppSidebar` com icone `Settings`
- Adicionar rota `/settings` no `App.tsx`

## Detalhes tecnicos

### Edge function `supabase/functions/invite-user/index.ts`
- Recebe POST com `{ email, role }`
- Valida token JWT do usuario chamador
- Consulta `user_roles` para confirmar que e admin
- Rejeita e-mails que nao terminam com `@cupola.com.br`
- Chama `supabase.auth.admin.inviteUserByEmail(email)`
- Insere registro em `user_roles` com a role escolhida

### Pagina Settings
- Hook customizado `useUsers` para listar profiles com roles
- Formulario com validacao zod
- Toast de sucesso/erro apos convite
- Condicional: se nao for admin, redireciona ou mostra mensagem de acesso negado

### Sidebar
- Novo item com icone `Settings` e url `/settings`, visivel apenas para admins

### Remover signup da tela de Login
- Remover a opcao "Criar conta" da pagina de Login, ja que novos usuarios serao criados apenas via convite
