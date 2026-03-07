

# Remover gráfico YoY e dados do evento anterior

## O que será feito

1. **Deletar 3.448 registros** de `ticket_sales` onde `event_id = 's28f3fa'` (evento 2025)
2. **Remover o componente `YearOverYearChart`** e todas as referências a ele
3. **Limpar código relacionado**: remover `useTicketSalesAllEvents`, `previousEventId` do `useSymplaEventIds`, props `allEventsTickets`/`currentEventId`/`previousEventId` de `SalesSection`, e imports não utilizados
4. **Remover `previous_event_id`** das credenciais da integração Sympla

## Arquivos afetados

- **DELETE** `src/components/dashboard/charts/YearOverYearChart.tsx`
- **Editar** `src/components/dashboard/SalesSection.tsx` — remover import do YearOverYearChart, props `allEventsTickets`, `currentEventId`, `previousEventId`, e bloco de renderização do gráfico
- **Editar** `src/pages/Index.tsx` — remover `useTicketSalesAllEvents`, `allEventsTickets`, `previousEventId` props
- **Editar** `src/hooks/useDashboardData.ts` — remover `useTicketSalesAllEvents`, remover `previousEventId` de `useSymplaEventIds`
- **SQL** — `DELETE FROM ticket_sales WHERE event_id = 's28f3fa'` e `UPDATE integrations SET credentials = credentials - 'previous_event_id' WHERE name = 'sympla'`

