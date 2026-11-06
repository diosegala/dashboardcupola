# Faturados entram no cupom da pessoa (Equipe CUPOLA)

## O que muda na página Cupons, card "Cupons em uso"
- Some a linha "FATURADO · Suellen", "FATURADO · Kariny" etc. e some a aba "Faturados".
- Cada venda faturada soma no cupom da equipe de quem vendeu: o faturado da Suellen soma em SUELLEN5, o da Kariny em KARINY5. Esses cupons ficam no grupo "Equipe CUPOLA" e contam usos e receita como qualquer venda da Sympla.
- Se o vendedor do faturado não tiver cupom da equipe, a venda entra em uma linha com o nome dele, também no grupo Equipe CUPOLA (sem a palavra "Faturado").
- O "i" e o texto de apoio do card deixam de citar "Faturados" como grupo separado.

## O que não muda
- O ranking da equipe já pontua faturados como venda normal; a regra continua igual.
- Os totais de ingressos, receita e descontos não mudam, só a forma de agrupar na tabela.

## Detalhes técnicos
- `src/pages/Coupons.tsx`: para `t.source === "pipedrive"`, usar `couponForSeller(t.seller, cuponsEquipe)` (mesma lógica do `buildTeamRanking`) e gerar a linha `{ code: cupom ?? nomeDoVendedor, group: "equipe", kind: "desconto" }`. A lista de cupons da equipe vem das vendas da Sympla (grupo equipe).
- Tirar a linha "faturado" de `COUPON_GROUPS` (fica só o tipo interno, sem aba).
- Atualizar textos em `metricInfo.ts` / descrição do card.
- Teste: faturado de "Suelen Moreira" soma no cupom SUELLEN5 e no grupo equipe.
