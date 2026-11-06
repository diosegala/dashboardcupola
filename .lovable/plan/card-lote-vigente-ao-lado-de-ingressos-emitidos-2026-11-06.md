# Card "Lote vigente" ao lado de Ingressos emitidos

Novo card na aba Comercial, no mesmo estilo do anel de "Ingressos emitidos", focado só no lote que está à venda agora.

## O que mostra

- Título "Lote vigente" + nome do lote (ex.: "2º Lote")
- Anel de progresso: vendidos do lote em relação à meta "Ingressos do lote" (aba Metas). No centro: número vendido e "de 300".
- Abaixo: **% vendido**, **Saldo** (quantos faltam para a meta), **Receita do lote** e **Vendidos hoje / últimos 7 dias** para dar noção de ritmo.
- Sem meta cadastrada para o lote: anel cheio na cor neutra, só o total vendido, e o aviso "Defina a meta do lote na aba Metas" (com o lápis para admins, como nos outros cards).
- Comparar com 2026 ligado: linha de comparação com o lote equivalente do ano anterior, se existir.
- "i": "Lote à venda agora: começa na primeira venda com o nome dele na Sympla e vale até a primeira venda do lote seguinte. Contam ingressos pagantes do lote; a meta vem de 'Ingressos do lote' na aba Metas."

## Onde fica

Linha 2 da aba Comercial passa a ter três cards: Ingressos emitidos (mais estreito), Lote vigente e Receita acumulada. Em telas menores eles empilham. A aba "Por lote" dentro de Ingressos emitidos continua igual.

Regras de lote e contagem não mudam: reutiliza exatamente o mesmo lote vigente, vendidos, saldo e receita já usados na tabela "Por lote". Nesta aba de lote, deixar a relação dos lotes como já aconte, nao quero mudar ela. então o novo card é sobre o lote vigente e a aba é a relação de todos como ja existe

&nbsp;

## Detalhes técnicos

- Novo `src/components/dashboard/CurrentBatchCard.tsx`, reaproveitando a lógica de `SalesSection.tsx` (lote atual via `src/lib/batches.ts`, meta via `findGoal` com `ticket_type`).
- `CommercialOverview.tsx`: grid da linha 2 vira `lg:col-span-5 / 3 / 4`; conferir se as abas de Ingressos emitidos cabem; se apertar, usar 6/6 e Receita desce para a linha seguinte ocupando largura cheia sem buracos.
- `metricInfo.ts`: entrada "Lote vigente".
- Teste pequeno para o cálculo de % e saldo do lote vigente.
- Conferir no navegador em 1036px e 1280px.