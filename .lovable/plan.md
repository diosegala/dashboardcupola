# Visita avulsa: diagnóstico, correção e quadro de visitas

## Parte 1. Como o sistema se comporta hoje (conferido no banco, evento Summit 27)

Há 3 visitas avulsas aprovadas ("Lote 1 | Visita (dia 19)"), todas de Pedro Souza, Diferencial Imóveis, em 24/11/2026, R$ 2.060,46 cada.

- a) Importada da Sympla: **sim**. As 3 estão na base, com o formulário completo.
- b) Somada no total de ingressos pagantes: **sim**. Conta como venda paga.
- c) Aparece nos gráficos por tipo: **não como visita**. A regra de tipo só reconhece "Visita presencial" no nome. "Visita (dia 19)" não tem essa palavra e cai em **Padrão**. A linha "Visita avulsa" do quadro por tipo fica zerada, e o Padrão fica com 3 a mais.
- d) Entra no ritmo, na meta e na receita: **sim, nos três**, como se fosse ingresso Padrão.

Pior cenário: **descartado em parte**. O total fecha com a soma das partes, mas as 3 visitas aparecem com o rótulo errado (Padrão). Também foi visto que, mesmo com o nome certo, a regra atual contaria a visita como pagante na meta. Isso também será corrigido.

## Parte 2. Causa raiz

- **Causa:** a regra que lê o tipo pelo nome da Sympla exige "visita presencial". O produto do Summit 27 se chama "Visita (dia 19)", então ele é lido como Padrão.
- **Quantas na base:** 3 visitas avulsas, todas de 24/11/2026. São as primeiras do evento.
- **Outros produtos:** os 17 nomes de ingresso do evento foram conferidos. Todos os outros caem no tipo certo: Padrão, VIP, Grupo ("2 a 5", "6 a 10", "a partir de 3"), Combo ("Combo Padrão", "Padrão + Visita" e "VIP + Visita") e Pré-venda. Nenhum outro é afetado.
- **Correção:** a visita avulsa passa a ser reconhecida por qualquer nome com "visita" que não traga Padrão, VIP, ingresso ou combo. O combo continua sendo reconhecido antes, pelo "+ Visita" ou "Combo". Não haverá exceção manual nem número fixo.

## Parte 3. Regra de contagem

- A visita avulsa ganha uma categoria própria, fora de "pagos". Por isso ela sai do total de ingressos pagantes, da meta, do ritmo e do número de pessoas no evento. Hoje a mudança tira 3 desses totais.
- O combo segue como 1 ingresso e 1 pessoa. A visita dentro dele não é somada de novo.
- **Receita (sem mudança):** hoje a visita avulsa entra na receita de ingressos como venda Sympla paga (3 × R$ 2.060,46 = R$ 6.181,38). Isso continua igual até você decidir.
- O card de Ritmo de vendas não muda. Ele só deixa de receber as visitas avulsas, como pede a Parte 3.

## Partes 4 e 5. Quadro de visitas (novo card no Comercial, junto ao quadro por tipo)

Proposta em um único card, com três blocos:

```text
Visitas vendidas            [i]
  7                    ← número grande (avulsas + combos)
  ███████ Combo 4 | ███ Avulsa 3   ← barra dividida

Finalidade da visita
  Venda ██████ 6 · Locação ██ 2 · Lançamento █ 1  (lidas da base)

Quem comprou visita avulsa  (lista que abre e fecha, fechada por padrão)
  Pedro Souza · Diferencial Imóveis · 24/11 · 3 visitas · Venda
```

- A finalidade vem da pergunta do formulário da Sympla sobre a visita presencial. As opções são lidas da base, então uma opção nova aparece sozinha. Quem não respondeu aparece como "Não informado".
- Na lista, as compras são agrupadas por comprador e dia, com nome, empresa, data, quantidade e finalidade. Quando um mesmo pedido tem finalidades diferentes, todas aparecem.
- O "i" explica, em linguagem simples, que a visita avulsa não dá acesso ao evento e por isso não entra no total de ingressos nem na meta, e que a visita do combo já está incluída no ingresso.
- O card segue o filtro de período da página, como os demais.

## Parte 6. Conferência

Antes de concluir, vou comparar no banco e na prévia:
- visitas do quadro: hoje são 3 avulsas e 4 de combo, total 7;
- respostas de finalidade (hoje 9), contra o número de visitas;
- total de pagantes contra a soma das partes do quadro por tipo.

Se alguma diferença aparecer, eu reporto antes de dar como pronto. Ponto já visto: o formulário tem 9 respostas de finalidade para 7 visitas. Parece que algum combo ou outro ingresso também responde à pergunta. Vou mostrar esse número separado e explicar.

## Fora do escopo
Regra de dias úteis, cadastro de lotes, card de Ritmo, banco e receita.

## Detalhes técnicos
- `src/lib/ticketKinds.ts`: novo reconhecimento de visita avulsa, com testes para "Visita (dia 19)", "Visita presencial", "Padrão + Visita" e "VIP + Visita".
- `src/lib/ticketCategory.ts`: nova categoria `visitas`, fora de `COUNTS_ON_GOAL`. Revisar `useCommercialMetrics`, `IssuedTicketsCard` e `CommercialOverview` para que a categoria não suma da receita.
- `src/lib/salesCategories.ts`: a "Visita avulsa" passa a ficar fora do total de ingressos do quadro por tipo.
- Novo `src/lib/visits.ts` (puro, com testes) com o resumo por origem, por finalidade e por comprador, lido do `custom_form` em `ticket_sales_details`. Novo `src/components/dashboard/VisitsCard.tsx`. Texto do "i" em `metricInfo.ts`.
