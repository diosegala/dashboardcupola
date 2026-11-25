# Quadro de visitas (Comercial)

## O que encontrei na base (Summit 27, pagas)
- 9 visitas: 3 avulsas ("Lote 1 | Visita (dia 19)", Pedro Souza, Diferencial Imóveis, 24/11) e 6 de combo (Lote 0: "Padrão + Visita" 2 e "Combo Padrão" 2; Lote 1: "Padrão + Visita" 1 e "VIP + Visita" 1).
- 9 respostas à pergunta "Em qual visita presencial no dia 19/05/2027 você prefere participar?", uma por visita: Venda 6, Locação 2, Lançamento 1. Não há "Não informado" hoje. Os números batem.
- A Sympla só envia as respostas dadas, não a lista de opções do formulário. Por isso o quadro mostra as opções que alguém já escolheu. Uma opção nova aparece sozinha assim que a primeira pessoa escolher.

## Proposta: um card, duas partes

```text
+-------------------------------------------------- (i) --+
| Visitas presenciais                                      |
|  9 visitas     [ 3 avulsas | 6 de combo ]  (barra dupla) |
|                                                          |
|  Finalidade escolhida                                    |
|  Venda       ██████████████  6   (avulsa 1 · combo 5)    |
|  Locação     █████           2   (avulsa 2)              |
|  Lançamento  ██              1   (combo 1)               |
|  Não informado (só se houver; motivo no mouse)           |
|                                                          |
|  Quem comprou visita avulsa                              |
|  Pedro Souza · Diferencial Imóveis · 24/11 · 3 visitas   |
|     Locação 2, Venda 1                                   |
|  [Ver no extrato]                                        |
+----------------------------------------------------------+
```
- Topo responde (a) e (b): número grande e barra dividida em avulsa e combo.
- Meio responde (c): barras por finalidade, cada uma com a divisão avulsa/combo.
- Rodapé responde (d) caso a caso: nome, empresa, data, quantidade e finalidades. Compras da mesma pessoa ficam agrupadas, como no extrato.
- "Não informado": no mouse, o motivo. Pode ser que a pessoa não respondeu, o pedido ainda não tem os dados da Sympla ou foi um faturado sem formulário.
- O card segue o período do topo da página.
- O "i" explica em linguagem simples: a visita avulsa não dá acesso ao evento, então fica fora do total de ingressos e da meta. No combo, a visita já está incluída no ingresso.

## Extrato e lista de compradores (item d)
- Extrato de vendas: novo filtro de tipo "Visita avulsa". A linha já mostra "Visita avulsa (sem participante)".
- Lista de compradores: um selo "Visita avulsa" ao lado de quem comprou, mais o mesmo filtro. A pessoa continua aparecendo como as demais.

## Conferência antes de concluir
Na prévia com a sua conta: 9 visitas (3 avulsas e 6 de combo) e 9 respostas (Venda 6, Locação 2, Lançamento 1). Se algum número não bater, aviso a diferença e a causa.

## Fora do escopo
Cadastro de lotes, lote das vendas, card de Ritmo e regra de dias úteis.

## Detalhes técnicos
- Nova função pura em `src/lib/visitBoard.ts`, com teste. Ela recebe as vendas e a resposta de cada uma e conta o número de visitas por origem (avulsa: `knownTicketKind`="visitas"; combo: tipo combo). Cada ingresso aprovado conta 1. Também agrupa por finalidade e por comprador avulso.
- A pergunta é encontrada pelo nome (`/visita presencial/i`), e as respostas vêm de `ticket_sales_details.participant_data.custom_form`. Elas são lidas como já fazem `buyers.ts` e `currentBuyers.ts`. O banco não muda. Se for preciso, a leitura passa pela mesma consulta de detalhes que o painel já usa.
- Novo `src/components/dashboard/VisitsCard.tsx`, colocado no Comercial ao lado de "Vendas por tipo de ingresso". Usa os mesmos tokens de cor e o `InfoTip`. Texto em `metricInfo.ts`.
- Filtro e selo em `SalesStatement.tsx` e `PeopleTable.tsx`.
