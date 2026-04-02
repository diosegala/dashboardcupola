

# Cadastro de metas direto no Dashboard via MetricCard

## Resumo

Adicionar um botao de lapis (editar/criar meta) nos MetricCards do dashboard que possuem campo de meta. Ao clicar, abre o GoalFormDialog pre-preenchido com a metrica correspondente e o periodo atual do dashboard.

## Implementacao

### 1. MetricCard — adicionar callback `onEditGoal`

Adicionar prop opcional `onEditGoal?: () => void` ao `MetricCard`. Quando presente, renderizar um icone de lapis (`Pencil`) ao lado do texto "Meta:" ou "Sem meta configurada", que ao clicar dispara o callback.

**Arquivo**: `src/components/dashboard/MetricCard.tsx`

### 2. Index.tsx — estado do dialog e logica de upsert

Mover/reutilizar a logica de criacao de metas (mutation de upsert + GoalFormDialog) para a pagina Index, similar ao que ja existe em Goals.tsx. Manter um estado `goalFormOpen` e `goalFormDefaults` (com `metric_key`, `period_start`, `period_end` pre-preenchidos baseados no range do dashboard).

Passar `onEditGoal` para SalesSection e MarketingSection, que repassam para os MetricCards relevantes.

**Arquivo**: `src/pages/Index.tsx`

### 3. SalesSection e MarketingSection — repassar callback

Adicionar prop `onEditGoal?: (metricKey: string, ticketType?: string | null) => void` a ambos os componentes. Cada MetricCard que tem `goal` passa o `onEditGoal` correspondente com a metric_key correta.

**Arquivos**: `src/components/dashboard/SalesSection.tsx`, `src/components/dashboard/MarketingSection.tsx`

### 4. Fluxo

1. Usuario clica no lapis de um card (ex: "Ingressos Vendidos")
2. Abre o GoalFormDialog com `metric_key="tickets_sold"`, `period_start` e `period_end` do range atual do dashboard
3. Se ja existe meta para essa metrica/periodo, pre-preenche o valor atual (edicao); senao, abre vazio (criacao)
4. Ao salvar, invalida cache e atualiza o dashboard

| Arquivo | Mudanca |
|---------|---------|
| `MetricCard.tsx` | Prop `onEditGoal`, icone Pencil |
| `Index.tsx` | GoalFormDialog + mutation upsert, estado, callbacks |
| `SalesSection.tsx` | Prop `onEditGoal`, repasse aos MetricCards |
| `MarketingSection.tsx` | Prop `onEditGoal`, repasse aos MetricCards |

