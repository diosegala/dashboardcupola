
# Adicionar card de total acumulado (all-time) de ingressos vendidos

## O que sera feito

Adicionar um card destacado no topo da secao de Vendas mostrando o total acumulado de ingressos vendidos de todos os tempos, independente do filtro de periodo selecionado.

## Implementacao

### 1. Criar query all-time em `useDashboardData.ts`

Adicionar um novo hook `useAllTimeTicketSales` que busca o total de ingressos sem filtro de data:

```typescript
export function useAllTimeTicketSales() {
  return useQuery({
    queryKey: ["ticket_sales_all_time"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("quantity, total_price");
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

### 2. Passar dados all-time para `SalesSection`

Em `Index.tsx`:
- Chamar o novo hook `useAllTimeTicketSales()`
- Incluir no loading state
- Passar como prop `allTimeTickets` para `SalesSection`

### 3. Adicionar card acumulado em `SalesSection.tsx`

Antes do grid de MetricCards existente, adicionar um card com destaque visual mostrando:
- Total acumulado de ingressos (all-time)
- Receita acumulada (all-time)
- Usar o componente `MetricCard` existente com icone diferenciado (ex: `Award` ou `Star`)
- O card tera um estilo levemente diferente (background com gradiente sutil) para se destacar como metrica all-time

O grid passara a ter 5 cards: 2 all-time (ingressos + receita) + 3 do periodo (ticket medio, deals ganhos, e um adicional se necessario), ou os 2 all-time em uma linha separada acima.

### Layout proposto

```
[Ingressos All-Time]  [Receita All-Time]
[Ingressos Periodo]  [Receita Periodo]  [Ticket Medio]  [Deals Ganhos]
```

Os cards all-time terao uma label "(acumulado)" para diferenciar dos cards filtrados por periodo.

## Arquivos alterados

1. `src/hooks/useDashboardData.ts` -- novo hook `useAllTimeTicketSales`
2. `src/pages/Index.tsx` -- chamar hook e passar prop
3. `src/components/dashboard/SalesSection.tsx` -- receber prop e renderizar cards all-time
