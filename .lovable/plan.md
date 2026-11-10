# Card "Padrão, VIP, combo ou grupo"

## O que muda
- **Nomes e ordem das linhas:** Padrão, VIP, Combo, Grupo, Visita avulsa. A linha "Individual" passa a se chamar **Padrão**. VIP fica logo abaixo de Padrão, e Combo vem em seguida, porque as três são modalidades que não são grupo. A barra colorida segue a mesma ordem.
- **Título do card:** "Padrão, VIP, combo ou grupo".
- **Mouse sobre Grupo e sobre Combo** (na linha e no trecho da barra): mostra quantos ingressos são Padrão e quantos são VIP, com o valor de cada um. Exemplo: "Padrão: 120 ingressos · R$ 95.000 / VIP: 6 ingressos · R$ 6.086".
- **Como sei se é VIP ou Padrão:** pelo nome do ingresso na Sympla. Se o nome tiver "VIP", conta como VIP; caso contrário, conta como Padrão. Exemplos: "Combo VIP - Visita" conta como VIP, e "10% OFF - 2 a 5 Ingressos Padrão" conta como Padrão. Grupos faturados internamente contam como Padrão, como já é hoje.
- **Visita avulsa:** é o ingresso "Visita Presencial", sem o evento. Os combos com visita continuam em Combo.
- **Explicação do "i":** atualizada com esses nomes e com a divisão entre VIP e Padrão.

Os totais de cada linha não mudam. Só os nomes, a ordem e os detalhes ao passar o mouse são novos.

## Detalhes técnicos
- `salesCategories.ts`: `SALES_CATEGORIES = ["Padrão","VIP","Combo","Grupo","Visita avulsa"]`; `CategoryRow` ganha `porNivel: { padrao, vip }` (ingressos e valor), usando `/\bvip\b/` no nome normalizado.
- Atualizar o componente do card (tooltip na linha e no segmento) e o texto em `metricInfo.ts`.
- Atualizar ou criar um teste: "Combo VIP - Visita" entra como VIP em Combo; "2 a 5 Ingressos Padrão" entra como Padrão em Grupo.
