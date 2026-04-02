

# Adicionar edição de metas no Funil de KPIs

## O que muda

Adicionar um ícone de lápis (`Pencil`) em cada célula de meta semanal da tabela do funil. Ao clicar, abre o `GoalFormDialog` pré-preenchido com a `metric_key` do funil e o período da semana correspondente.

## Implementação

### 1. `FunnelKPISection.tsx`
- Adicionar prop `onEditGoal?: (metricKey: string) => void` à interface.
- Nas células de meta (tanto semanais quanto o total), renderizar um ícone `Pencil` pequeno ao lado do valor. O clique chamará uma função que invoca `onEditGoal` passando a `metric_key` e o período correto (semana ou range total).
- Como o callback precisa informar também o período específico, a prop será ajustada para `onEditGoal?: (metricKey: string, periodStart: Date, periodEnd: Date) => void`.

### 2. `Index.tsx`
- Passar `onEditGoal` ao `FunnelKPISection` com a mesma lógica de `handleEditGoal`, mas aceitando `periodStart`/`periodEnd` explícitos (em vez de usar o range do dashboard).

| Arquivo | Mudança |
|---------|---------|
| `FunnelKPISection.tsx` | Prop `onEditGoal`, ícone Pencil nas células de meta |
| `Index.tsx` | Passar callback ao FunnelKPISection |

