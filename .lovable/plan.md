

# Adicionar preset "Esta semana" no seletor de período

## Alteração em `src/components/dashboard/PeriodSelector.tsx`

Adicionar um novo item no array `presets`, entre "Últimos 7 dias" e "Últimos 30 dias", usando `startOfWeek` e `endOfWeek` do `date-fns` com `{ weekStartsOn: 1 }` (segunda-feira):

```ts
{ label: "Esta semana", getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) }
```

Importar `startOfWeek` e `endOfWeek` do `date-fns`.

