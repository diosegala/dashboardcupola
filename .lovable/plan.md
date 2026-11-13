# Cadastro completo e página "Meu perfil"

## Como está hoje
- O admin convida só com e-mail e papel; a pessoa recebe um link e cria a própria senha.
- O nome fica guardado, mas para a maioria das contas antigas ele é o próprio e-mail (ex.: "alice.santos@cupola.com.br"). Por isso aparece e-mail no topo.
- Não existe tela para a pessoa trocar o próprio nome ou senha.

## O que vou fazer

1. **Cadastro em Configurações › Usuários**: o formulário passa a ter Nome completo, E-mail, Papel e Senha inicial (com confirmação, mínimo 8 caracteres). A conta já nasce pronta para entrar com essa senha, sem link por e-mail. O convite por link continua disponível como opção, para quem preferir que a pessoa crie a senha.
2. **Contas antigas**: sem mexer em papéis, cupons ou acessos. Quem tem o e-mail no lugar do nome ganha um nome tirado do e-mail (alice.santos → Alice Santos). Cada pessoa pode corrigir depois no perfil, e o admin também pode editar o nome na lista de usuários.
3. **Página "Meu perfil"** para todos os papéis, aberta clicando no nome no canto superior direito:
   - ver e editar o nome, com botão Salvar;
   - trocar a senha digitando a nova duas vezes;
   - o papel aparece só para leitura.
4. **Regra única de nome**: cada palavra com a primeira letra maiúscula e o resto minúsculo, mantendo acentos (joão pedro → João Pedro). O nome já é salvo assim.
5. **Onde o nome aparece**: canto superior direito mostra só o primeiro nome; saudação "Bora vender, {primeiro nome}!"; ranking e área da equipe usam o nome cadastrado. Tudo atualiza na hora ao salvar o perfil.
6. **Segurança**: cada pessoa só consegue alterar o próprio nome; o papel continua mudando só pelo admin. Senhas ficam com o sistema de login, nunca guardadas por nós.
7. **Testes**: regra de nomes com os seus exemplos; depois entro como Admin, Visualizador e Equipe para abrir o perfil, trocar nome e ver o topo e a saudação mudarem.

## Detalhes técnicos
- `src/lib/personName.ts` (puro, testado): `formatPersonName`, `firstName`, `nameFromEmail`.
- Edge function `invite-user`: aceitar `name` e `password` opcionais; com senha usa `auth.admin.createUser({ email_confirm: true, user_metadata: { name } })`, sem senha mantém o convite atual. Trigger `handle_new_user` já grava o nome; passa a formatá-lo.
- Atualização de dados: preencher `profiles.name` a partir do e-mail onde `name` contém "@".
- RLS de `profiles` UPDATE: adicionar `WITH CHECK (auth.uid() = id)`; admin pode atualizar nome via `manage-user`.
- Nova rota `/perfil` liberada também para a Equipe (`TELAS_EQUIPE`); `useAuth` ganha `refreshProfile()`; senha via `supabase.auth.updateUser({ password })`.
