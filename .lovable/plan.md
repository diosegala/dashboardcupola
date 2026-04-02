

# Meta do Período Total = Soma das Metas Semanais

## O que muda

Hoje a coluna "Período Total" busca uma meta própria via `findGoal` para o range inteiro do mês. A proposta é: em vez disso, **somar os `target_value` das metas semanais encontradas** para cada linha do funil. Assim o usuário só precisa cadastrar metas semanais e o total se calcula automaticamente.

## Implementação

### Arquivo: `src/components/dashboard/FunnelKPISection.tsx`

Na seção do `tbody` onde se renderiza cada linha (em torno da linha 215-220), a lógica atual é:

```ts
const totalGoal = findGoal(goals, def.metricKey, range);
const totalTarget = totalGoal ? Number(totalGoal.target_value) : null;
```

Substituir por uma soma das metas semanais já calculadas logo abaixo:

```ts
// Calcula meta de cada semana
const weekTargets = weeks.map((w) => {
  const g = findGoal(goals, def.metricKey, { from: w.from, to: w.to });
  return g ? Number(g.target_value) : null;
});

// Total = soma das metas semanais (se pelo menos uma existir)
const hasAnyWeekGoal = weekTargets.some((t) => t !== null);
const totalTarget = hasAnyWeekGoal
  ? weekTargets.reduce((sum, t) => sum + (t ?? 0), 0)
  : null;
```

Os `weekTargets` serão reutilizados nas colunas semanais em vez de recalcular `findGoal` novamente no loop de renderização.

Nenhum outro arquivo precisa ser alterado.

