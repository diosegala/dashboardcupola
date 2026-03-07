

# Corrigir cards "acumulado" para mostrar apenas evento 2026

## Problema

A função `useAllTimeTicketSales` busca **todos** os registros de `ticket_sales` sem filtrar por `event_id`. Isso inclui ingressos do evento de 2025 e 2026 nos cards "Ingressos Vendidos (acumulado)" e "Receita Total (acumulado)".

## Solução

Filtrar `useAllTimeTicketSales` pelo `event_id` do evento atual (2026):

1. **`src/hooks/useDashboardData.ts`**: Alterar `useAllTimeTicketSales` para receber `eventId: string` como parâmetro e adicionar `.eq("event_id", eventId)` na query. Incluir `eventId` na `queryKey`.

2. **`src/pages/Index.tsx`**: Passar `symplaIds.data?.currentEventId` para `useAllTimeTicketSales`. Ajustar a ordem de carregamento para que `symplaIds` esteja disponível antes.

## Arquivos editados
- `src/hooks/useDashboardData.ts`
- `src/pages/Index.tsx`

