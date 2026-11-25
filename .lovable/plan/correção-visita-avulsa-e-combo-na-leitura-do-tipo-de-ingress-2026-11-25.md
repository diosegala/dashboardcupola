# Correção: visita avulsa e combo na leitura do tipo de ingresso

## O que os dados mostram hoje (Summit 27)


| Produto na Sympla                           | Vendidos na base | Como a regra lê hoje | Correto       |
| ------------------------------------------- | ---------------- | -------------------- | ------------- |
| Lote 1 | Visita (dia 19)                    | 3                | **Padrão (errado)**  | Visita avulsa |
| Lote 0 | Padrão + Visita (dias 19, 20 e 21) | 2                | Combo                | Combo         |
| Lote 0 | Combo Padrão (dias 19, 20 e 21)    | 2                | Combo                | Combo         |
| Lote 1 | Padrão + Visita (dias 19, 20 e 21) | 1                | Combo                | Combo         |
| Lote 1 | VIP + Visita (dias 19, 20 e 21)    | 1                | Combo (VIP)          | Combo         |


- **Visitas avulsas:** a causa é que a regra só reconhece o nome "Visita presencial". "Visita (dia 19)" não tem essa palavra, então cai em Padrão.
- **Combos:** a base guarda os 4 do Lote 0 com dois nomes. São 2 como "Padrão + Visita" e 2 como "Combo Padrão", porque a Sympla mudou o nome entre versões. A regra lê os dois nomes como combo, então na leitura do tipo os 6 já são combo.
- Se o painel mostra menos de 6 combos, a perda vem de outra etapa, como um filtro de lote ou de nome no card. Por isso, o primeiro passo da implementação é achar na prévia onde o número cai e corrigir ali.

## O que será feito

1. **Visita avulsa reconhecida pelo nome.** Entra qualquer produto com "visita" que não seja combo ("+ Visita" ou "Combo") e não traga Padrão, VIP ou "ingresso". Não haverá exceção manual nem número fixo.
2. **Combos:** os 6 ficam como combo, valendo 1 ingresso e 1 pessoa cada. A visita incluída não é somada de novo.
3. **Visita avulsa sai de:** total de pagantes, meta, ritmo e pessoas no evento. Ela passa a ter uma categoria própria, fora de "pagos".
4. **Receita:** a visita avulsa continua no total do evento (R$ 6.181,38), mas sai do ticket médio de ingressos, no card Receita acumulada e no quadro por tipo.
5. **Quadro por tipo:** a linha "Visita avulsa" fica fora do total de ingressos do quadro. O total passa a fechar com Padrão + VIP + Combo + Grupo.

## Conferência que vou entregar

- a) Pagantes antes e depois. Hoje a prévia mostra 241; a expectativa é 238 (−3). O número final será confirmado no banco e na prévia.
- b) Se o total de ingressos fecha com a soma das categorias dos gráficos.
- c) Os 17 nomes de produto, um a um, com a categoria resultante e a quantidade real da base. Os números serão comparados com os da Sympla que você enviou: 3 avulsas, 6 combos, 9 visitas.

## Fora do escopo

Quadro de visitas, cadastro de lotes, atribuição de lote das vendas e card de Ritmo de vendas (ele só deixa de receber as avulsas). Regra de dias úteis e banco também ficam como estão.

## Detalhes técnicos

- `src/lib/ticketKinds.ts`: regra nova para "Visita presencial" e testes com os 17 nomes reais.
- `src/lib/ticketCategory.ts`: nova categoria `visitas`, fora de `COUNTS_ON_GOAL`. Ajustar `useCommercialMetrics`, `IssuedTicketsCard` e `CommercialOverview` para manter a receita e excluir a visita do ticket médio e de pessoas.
- `src/lib/salesCategories.ts`: "Visita avulsa" fora do total e do ticket médio do quadro.  
  
Aprovado. Implemente, com dois acréscimos.
  1. Alerta para produto sem classificação
  A regra continua reconhecendo o tipo pelo nome do produto, e foi isso que
  causou essa falha. Inclua um alerta visível no dashboard quando aparecer um
  produto da Sympla que não se encaixe em nenhuma categoria conhecida, em vez
  de encaixá-lo por semelhança de nome. Assim, se a Sympla renomear ou criar
  um produto novo, eu fico sabendo na hora em vez de descobrir pelo número
  errado semanas depois.
  2. Relate onde o combo estava se perdendo
  Você identificou que na leitura de tipo os 6 combos já estão corretos e que
  a perda acontece em outra etapa. Quando encontrar, me diga exatamente onde
  era e se essa mesma etapa está derrubando algum outro número do dashboard.
  Na conferência final, confirme também que o quadro por tipo passa a mostrar
  6 combos.