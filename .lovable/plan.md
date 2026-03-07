

# Corrigir card "Ingressos Vendidos (acumulado)" mostrando 1000

## Problema

A função `useAllTimeTicketSales` (linha 94-104 de `useDashboardData.ts`) faz uma query simples sem paginação:
```ts
supabase.from("ticket_sales").select("quantity, total_price")
```
Isso retorna no máximo 1000 linhas (limite padrão do Supabase). Como cada linha tem `quantity: 1`, o card mostra exatamente 1000 ingressos — o limite da query, não o total real.

## Solução

Adicionar paginação à `useAllTimeTicketSales`, igual ao que já foi feito em `useTicketSalesAllEvents`. Loop com `.range(from, from + pageSize - 1)` até esgotar os registros.

## Arquivo editado
- `src/hooks/useDashboardData.ts` — função `useAllTimeTicketSales`

