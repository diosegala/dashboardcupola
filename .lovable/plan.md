

# Gráfico de Vendas por Dia da Semana

## O que será feito

Criar um gráfico de barras mostrando o total de ingressos vendidos agrupados por dia da semana (Segunda a Domingo), usando todo o histórico de vendas (`allTimeTickets`).

## Implementação

### 1. Criar `src/components/dashboard/charts/TicketsByWeekdayChart.tsx`
- Recebe `allTimeTickets` como prop
- Agrupa por dia da semana usando `getDay()` do `sold_at`
- Gráfico de barras (Recharts `BarChart`) com os 7 dias da semana em português (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
- Ordenado de Segunda a Domingo

### 2. Editar `SalesSection.tsx`
- Importar e renderizar o `TicketsByWeekdayChart` na grid de gráficos, passando `allTimeTickets`
- Posicionar abaixo dos gráficos existentes, em largura total para destacar o padrão semanal

