# Senha obrigatória antes de entrar no painel

## O que aconteceu (confirmado nos registros)
- O link do convite funcionou. Todas as tentativas de salvar foram recusadas porque a senha escolhida aparece em listas de senhas vazadas (é a proteção contra senhas vazadas que ligamos antes).
- A tela não explicou esse motivo de forma clara.
- O link do e-mail já abre uma sessão. Por isso, mesmo com o erro, a pessoa entrou no painel ao sair da tela.
- O status "Ativo" hoje conta "clicou no link", não "criou a senha".

## O que muda
1. **Erro claro**: quando a senha for recusada por estar vazada, a mensagem diz: "Essa senha já apareceu em vazamentos na internet. Escolha outra, de preferência uma frase com números." Também traduzo os demais erros.
2. **Sem senha, sem painel**: quem chega pelo link de convite ou de redefinição fica preso na tela de criação de senha até salvar com sucesso. Se a pessoa tentar abrir qualquer outra página, volta para essa tela. Se fechar a aba, é desconectada e precisa usar o link de novo (enquanto ele valer) ou pedir um novo.
3. **"Ativo" de verdade**: a pessoa só conta como Ativa depois de salvar a senha. Antes disso aparece "Convite pendente", e o botão de reenviar manda o convite de novo.
4. **Corrigir o eventos@**: ele volta a aparecer como pendente. Basta reenviar o convite e criar uma senha nova.

## Detalhes técnicos
- `SetPassword.tsx`: mapear `weak_password`/"known to be weak" em `traduzirErro`; ao montar, gravar `sessionStorage` com a marca `must_set_password`; limpar só após `updateUser` ok, gravando `user_metadata.password_set_at`.
- Guarda de rotas (layout protegido): se a marca existir, ou se `user_metadata.password_set_at` estiver ausente para usuários convidados, redirecionar para `/set-password`; o botão "Sair" faz `signOut`.
- `manage-user` (list): `active = !!user_metadata.password_set_at` (usuários antigos com `last_sign_in_at` por senha ficam como ativos por um backfill único no metadata); `resend_invite` decide convite ou redefinição pelo mesmo critério.
- `Settings.tsx`: selo e filtro passam a usar `active`.
- Redeploy de `manage-user`. Teste com eventos@: senha vazada mostra a mensagem certa, navegar para `/` volta à tela, senha forte salva e vira Ativo.
