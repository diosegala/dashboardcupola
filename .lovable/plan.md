

# Comparar metas conforme o período selecionado no Dashboard

## Problema atual

A função `findGoal` em `useDashboardData.ts` busca a meta cujo período contém a **data de hoje** (`new Date()`). Isso significa que, ao selecionar "Esta semana" no dashboard, o sistema pode mostrar uma meta mensal em vez da meta semanal correspondente.

## Solução

Alterar `findGoal` para receber o `DateRange` selecionado no dashboard e encontrar a meta cujo período (`period_start` / `period_end`) melhor se encaixa no intervalo selecionado, priorizando a meta com maior sobreposição proporcional.

## Alterações

### 1. `src/hooks/useDashboardData.ts` — atualizar `findGoal`

Alterar a assinatura para receber o range do dashboard em vez de uma data única:

```ts
export function findGoal(goals: any[], metricKey: string, range: DateRange) {
  const rangeFrom = fmt(range.from);
  const rangeTo = fmt(range.to);
  
  // Buscar metas que se sobrepõem ao período selecionado
  const overlapping = goals
    .filter((g: any) => g.metric_key === metricKey && g.period_start <= rangeTo && g.period_end >= rangeFrom);
  
  if (overlapping.length === 0) return null;
  
  // Priorizar a meta cujo período tem maior sobreposição proporcional
  // (meta semanal para filtro semanal, meta mensal para filtro mensal)
  const scored = overlapping.map((g: any) => {
    const gStart = new Date(g.period_start).getTime();
    const gEnd = new Date(g.period_end).getTime();
    const rStart = range.from.getTime();
    const rEnd = range.to.getTime();
    const overlapStart = Math.max(gStart, rStart);
    const overlapEnd = Math.min(gEnd, rEnd);
    const overlapDays = Math.max(0, overlapEnd - overlapStart);
    const goalDays = gEnd - gStart || 1;
    const rangeDays = rEnd - rStart || 1;
    // Score: quanto mais o período da meta "casa" com o período selecionado, melhor
    const score = overlapDays / Math.max(goalDays, rangeDays);
    return { goal: g, score };
  });
  
  scored.sort((a, b) => b.score - a.score || 
    new Date(b.goal.created_at).getTime() - new Date(a.goal.created_at).getTime());
  
  return scored[0]?.goal ?? null;
}
```

A lógica de scoring garante que:
- Se o usuário seleciona "Esta semana", uma meta semanal (7 dias) terá score maior que uma meta mensal (30 dias)
- Se seleciona "Este mês", a meta mensal terá score maior

### 2. `src/pages/Index.tsx` — passar o `range` para as seções

Adicionar a prop `range` ao `SalesSection` e `MarketingSection`:

```tsx
<SalesSection tickets={...} goals={...} allTimeTickets={...} range={range} />
<MarketingSection adMetrics={...} emailCampaigns={...} siteAnalytics={...} goals={...} range={range} />
```

### 3. `src/components/dashboard/SalesSection.tsx`

- Adicionar `range: DateRange` à interface de props
- Alterar chamadas de `findGoal(goals, "tickets_sold")` para `findGoal(goals, "tickets_sold", range)`
- Idem para `"revenue"`

### 4. `src/components/dashboard/MarketingSection.tsx`

- Adicionar `range: DateRange` à interface de props
- Alterar todas as chamadas de `findGoal(goals, "...", )` para incluir `range` como terceiro argumento (meta_impressions, meta_link_clicks, meta_purchases, meta_conversion_rate, google_impressions, google_clicks, email_open_rate, email_click_rate, site_visits)

### Arquivos editados
- `src/hooks/useDashboardData.ts`
- `src/pages/Index.tsx`
- `src/components/dashboard/SalesSection.tsx`
- `src/components/dashboard/MarketingSection.tsx`

