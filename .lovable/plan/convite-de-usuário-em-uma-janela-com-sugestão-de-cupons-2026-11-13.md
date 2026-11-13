# Convite de usuário em uma janela, com sugestão de cupons

## O que muda

- No card Usuários, o formulário apertado sai e entra o botão **"Convidar usuário"**, igual ao "Novo evento". O botão abre uma janela com os campos em linhas inteiras: nome completo, e-mail (@cupola.com.br), função e cupons.
- **Sugestão de cupons:** enquanto você digita o nome ou o e-mail, a janela mostra os cupons já cadastrados que podem ser dessa pessoa. A comparação considera nome completo, primeiro nome e primeiro nome com a inicial do sobrenome. Basta clicar para escolher. Só aparecem cupons que ainda não são de ninguém. não gostei da lista completa ali, fica feio. ao lado do nome, indicar qual é exatamente o cupom. pessoas que tem mais de um cupom já criado pode selecionar. pessoas podem ter mais de um cupom, eles aparecem espeficos cada um para ela e para o admin, no rackink sempre agrupa, para não ser redundante e tbm conta conforme o evento. 
- **Opção "Automático":** é a escolha padrão e não liga nada agora. O vínculo é feito sozinho depois, com os cupons que ainda não têm dono.
- **Digitar o cupom direto:** se o cupom não estiver na lista, você pode escrever o código. Ele segue as mesmas regras de hoje: só letras e números, em maiúsculas, sem espaços, acentos ou símbolos. Mais de um código são separados por vírgula. Ao convidar, é criada uma ficha de cupom com o nome da pessoa, já ligada à conta dela.
- A janela de editar a pessoa (quando você clica no nome) passa a usar as mesmas sugestões e o mesmo campo para digitar o cupom. nao gostei da cor do texto do dioner em verde, por exemplo e outras letras pequenas em verde 

## Detalhes técnicos

- Novo `InviteUserDialog` (Dialog `max-w-lg rounded-[24px]`, padrão do EventsManager) aberto pelo botão no cabeçalho do card Usuários. O formulário inline sai de `Settings.tsx`.
- `suggestCouponPeople(account, people)` em `src/lib/couponLink.ts` traz a lista de candidatos livres, ordenada por força do cruzamento. Ganha testes.
- O campo de digitar reaproveita o `normalizeCode` do `CouponPeopleManager`, com o filtro de caracteres feito ao digitar. Se o código digitado já existe em outra ficha, o campo avisa e sugere escolher essa ficha.
- Depois do convite, uma ficha existente escolhida é ligada com `setCouponPersonForUser`. Códigos novos viram um insert em `coupon_people` com `user_id` e `link_manual = true`.