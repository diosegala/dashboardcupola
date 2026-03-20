

# Corrigir seleção de dia único no calendário

## Problema

Ao selecionar um único dia (ex: dia 18), o `tempRange` fica `{ from: 18/03 00:00, to: 18/03 00:00 }`. A query filtra `sold_at <= 2026-03-18T00:00:00.000Z`, excluindo todos os ingressos vendidos **durante** o dia 18 (que têm horários como `12:49`, `14:38`, etc.).

## Correção — `src/components/dashboard/PeriodSelector.tsx`

No `handleApply` e no `onSelect` do calendário, aplicar `endOfDay()` no `to`:

```tsx
// onSelect (linha 101-102):
if (r?.from && r?.to) setTempRange({ from: startOfDay(r.from), to: endOfDay(r.to) });
else if (r?.from) setTempRange({ from: startOfDay(r.from), to: endOfDay(r.from) });
```

`startOfDay` e `endOfDay` já estão importados. Isso garante que ao selecionar "18 mar – 18 mar", a query use `T23:59:59.999Z` como limite superior, capturando todos os registros do dia.

