# Vínculo automático entre contas e cupons

## O que muda para quem usa
- **Configurações › Usuários**: a lista fica como está, sem o campo de cupom. Clicar numa pessoa abre um painel com os dados dela: nome, e-mail, função, cupom vinculado e um botão para enviar o link de troca de senha. O admin pode editar tudo isso.
- **Meu perfil**: a pessoa vê o cupom dela, só para leitura. Se não houver cupom ou ele estiver errado, aparece: "Algo não bate? Fale com o administrador."
- **Vínculo automático**: o painel liga a conta à pessoa certa do cadastro de cupons. Primeiro procura o e-mail, depois o nome completo e, por fim, os nomes de quem vende (ex.: "Suellen Moreira"). Se a pessoa entrar antes de ter cupom, o vínculo é feito sozinho quando o cupom for cadastrado.
- **Um cupom por pessoa, sem repetição**: cada pessoa tem uma única ficha no cadastro de cupons. O mesmo código vale em todos os eventos, então nunca aparece duplicado.

## Pontos de atenção
- Hoje algumas pessoas têm vários códigos na mesma ficha (Suellen: SUELLEN5, SUELLEN10, SUELLEN20; Leticia B: 3 códigos). Esses códigos continuam contando para a pessoa e aparecem agrupados como **um só vínculo**. O perfil mostra o código principal e, logo abaixo, os outros.
- Fichas com nomes curtos parecidos (Aline B, Aline P e Aline Pavezi) não são ligadas por adivinhação. Se houver dúvida, a conta fica sem vínculo até o admin escolher.
- A ligação que o admin faz à mão sempre vale mais que a automática.

## Detalhes técnicos
- Nova coluna opcional `coupon_people.user_id` (uuid, única), com a ficha ligada à conta, e `coupon_people.email` (opcional) para o cruzamento.
- Uma função no banco, `link_coupon_person(user_id)`, faz o cruzamento por e-mail, nome completo normalizado (sem acento e sem diferença de maiúsculas) e `seller_names`. Ela só liga quando há um único resultado. Roda ao entrar no app, quando uma ficha é criada ou alterada, e quando o perfil muda.
- O `useTeam` passa a ler a pessoa ligada em `coupon_people`, e não mais em `team_coupons`, que fica marcada como descontinuada e sem uso. O card "Sua posição" continua funcionando.
- Remover o `TeamCouponInput` de `Settings.tsx` e criar uma gaveta de edição da pessoa (`UserDetailSheet`) com nome, e-mail, função, seletor de ficha de cupom e envio de troca de senha.
- `manage-user` ganha a ação `update_user`, só para admin: troca o e-mail pelo admin do backend, já confirmado, e o nome no perfil. A senha é trocada por link de redefinição, nunca digitada pelo admin. Se for preciso definir uma senha direto, há uma opção extra com no mínimo 8 caracteres.
- `Profile.tsx` mostra o cupom só para leitura e o aviso para falar com o administrador.
- Testes para a regra de cruzamento: e-mail, nome, nome ambíguo sem vínculo e a ligação manual valendo mais que a automática.
- Atualizar a regra no AGENTS.md: a identidade de quem está logado no ranking passa a vir só de `coupon_people.user_id`.
