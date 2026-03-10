

# Fix: Gráfico de Vendas por Dia da Semana sem dados

## Problema

A query `useAllTimeTicketSales` seleciona apenas `quantity, total_price`. O componente `TicketsByWeekdayChart` precisa do campo `sold_at` para calcular o dia da semana com `getDay()`.

## Solução

Editar `src/hooks/useDashboardData.ts`, linha 105: trocar `.select("quantity, total_price")` por `.select("quantity, total_price, sold_at")`.

Apenas essa mudança de uma linha resolve o problema — o `getDay(new Date(t.sold_at))` no chart já faz o mapeamento de data para dia da semana corretamente.

