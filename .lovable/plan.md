# Criar usuário admin emillyn.machado@cupola.com.br

## O que será feito

1. Verificar se o e-mail já existe no sistema (por exemplo, por um convite anterior).
   - Se existir: definir a senha informada, confirmar o e-mail e atribuir a função **Admin**.
   - Se não existir: criar o usuário com a senha informada, já com e-mail confirmado, e atribuir **Admin**.
2. Conferir que o usuário aparece como "Ativo" e "Admin" na página Configurações.

## Detalhes técnicos

- Adicionar a ação `create_user` (e-mail, senha, função) na função `manage-user`. Ela usa `auth.admin.createUser` com `email_confirm: true`, ou `updateUserById` se o usuário já existir, e depois grava a função em `user_roles` com delete+insert. A ação fica restrita a admins e aceita só e-mails @cupola.com.br.
- Para criar esse primeiro usuário agora, a ação é chamada uma única vez pelo servidor. A senha não é salva no código.
- Opcional: adicionar no formulário de Configurações a opção "Criar com senha" ao lado de "Convidar".

## Aviso de segurança

A senha "12345678" é muito fraca e aparece em listas de senhas vazadas. Se a proteção contra senhas vazadas estiver ligada, ela pode ser recusada. Recomendo trocar a senha logo no primeiro acesso.
