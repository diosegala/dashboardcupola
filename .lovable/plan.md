

# Alterações: Semana qui–qua para KPIs, exclusão para viewers, botão clonar

## 1. Semana de quinta a quarta no Funil de KPIs

No `FunnelKPISection.tsx`, a função `getWeeksInRange` atualmente usa `weekStartsOn: 1` (segunda). Alterar para usar **`weekStartsOn: 4`** (quinta-feira), fazendo as semanas do funil irem de quinta a quarta.

No `GoalFormDialog.tsx`, o atalho "Semana" também usa `weekStartsOn: 1`. Para metas de KPIs (métricas do funil), alterar para `weekStartsOn: 4`. Como o formulário permite qualquer métrica, a abordagem será: adicionar um atalho separado **"Semana KPI (Qui–Qua)"** ao lado do atalho de semana padrão (Seg–Dom), para que o usuário escolha o formato correto.

**Arquivos**: `src/components/dashboard/FunnelKPISection.tsx`, `src/components/goals/GoalFormDialog.tsx`

## 2. Liberar exclusão de metas para viewers

### Database
Criar migration com RLS policy `DELETE` para `authenticated`:
```sql
CREATE POLICY "Authenticated users can delete goals"
ON public.goals FOR DELETE TO authenticated USING (true);
```

### UI (`Goals.tsx`)
Remover o condicional `{isAdmin && ...}` do botão de excluir — exibir para todos os usuários autenticados.

## 3. Botão de clonar meta

No `Goals.tsx`, adicionar um botão com ícone `Copy` ao lado dos botões de editar/excluir. Ao clicar, abre o formulário de criação pré-preenchido com os dados da meta clonada (mesma métrica, valor-alvo, tipo de lote), mas com o label prefixado com "Cópia de " e sem ID (para criar uma nova meta).

**Arquivo**: `src/pages/Goals.tsx`

## Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `FunnelKPISection.tsx` | `weekStartsOn: 4` em `getWeeksInRange` |
| `GoalFormDialog.tsx` | Adicionar atalho "Semana KPI (Qui–Qua)" com `weekStartsOn: 4` |
| `Goals.tsx` | Remover `isAdmin` do botão excluir; adicionar botão clonar |
| Migration SQL | Policy `DELETE` para `authenticated` na tabela `goals` |

