# Pré-venda até 31/10/2026, o resto no Lote 0

## Regra nova (a pedido)
- **Pré-venda:** todos os ingressos pagos (Sympla e faturados) vendidos antes de 01/11/2026, horário de Brasília.
- **Lote 0:** tudo pago a partir de 01/11/2026, qualquer que seja o nome do ingresso, até existir um lote seguinte.
- Lotes seguintes (Lote 1, 2…) continuam começando na primeira venda com o nome deles na Sympla.

Hoje a virada da Pré-venda para o Lote 0 é automática: acontece na primeira venda "Lote 0" na Sympla (03/11). A data passa a ser fixa em 01/11.

## O que já vi nos dados
- Sympla: 18 pagos com nome "Pré-Venda" (maio a junho) e 42 "Lote 0" (desde 03/11).
- Os demais ~73 vêm dos faturados do Pipedrive; eles entram no lote pela data da venda.
- A causa exata dos números 64/69 ainda não está confirmada. Primeiro passo: listar quais faturados estão caindo em cada lote e com qual data (ganho ou criação), e ajustar se a data usada estiver errada.

## Onde muda
Vale para todo o painel ao mesmo tempo: card "Lote vigente", aba "Por lote", metas por lote e rankings por lote, porque todos usam a mesma regra.

## Detalhes técnicos
- `src/lib/batches.ts`: constante `FIM_PRE_VENDA = "2026-11-01T03:00:00Z"`; em `batchStarts`, Lote 0 começa nessa data (e Pré-venda vai até ela), mesmo que a primeira venda "Lote 0" seja depois.
- Conferir data usada para faturados em `useDashboardData.ts`/`invoicedTickets.ts` (`won_at`).
- Testes em `src/lib/invoicedTickets.test.ts`/novo `batches.test.ts`: venda 31/10 23:59 BRT → Pré-venda; 01/11 00:00 BRT → Lote 0; ingresso "Pré-Venda" vendido em 02/11 → Lote 0.
- Conferir no navegador a soma Pré-venda + Lote 0 = 133.
