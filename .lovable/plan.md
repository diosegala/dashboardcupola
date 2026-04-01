

# Metas por Lote/Tipo de Ingresso

## Problema

Atualmente as metas de vendas (`tickets_sold`, `revenue`) são globais — não há como definir "vender 500 ingressos VIP na semana 3" e acompanhar separadamente. O diretor quer ver o progresso por lote/tipo de ingresso.

## Abordagem

Adicionar um campo opcional `ticket_type` na tabela `goals`. Quando preenchido, o cálculo do realizado filtra `ticket_sales` pelo tipo correspondente. Quando vazio, funciona como hoje (total geral).

## Implementação

### 1. Migration — coluna `ticket_type` na tabela `goals`

```sql
ALTER TABLE goals ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT NULL;
```

### 2. `GoalFormDialog.tsx` — campo condicional "Lote de Ingresso"

- Quando a métrica selecionada for `tickets_sold`, `revenue`, `funnel_bofu_sales` ou `funnel_bofu_revenue`, exibir um campo extra `Select` com os tipos de ingresso disponíveis
- Os tipos são buscados via query distinta em `ticket_sales` (`SELECT DISTINCT ticket_type`)
- Opção "Todos os lotes" (valor `null`) + lista dos tipos existentes
- Novo hook `useTicketTypes()` para buscar os tipos distintos

### 3. `goalMetrics.ts` — sem mudança de metric_keys

Reutilizar as mesmas keys (`tickets_sold`, `revenue`, `funnel_bofu_sales`, `funnel_bofu_revenue`). A diferenciação é feita pelo campo `ticket_type` no goal.

### 4. `useDashboardData.ts` — atualizar `findGoal`

Considerar `ticket_type` na busca de metas: quando o goal tem `ticket_type` preenchido, ele só "matcha" se o contexto de busca também especificar aquele tipo. Para o funil KPI e sales section, buscar metas com `ticket_type = null` (total geral).

### 5. `FunnelKPISection.tsx` e `SalesSection.tsx` — exibir metas por lote

- Na `SalesSection`, adicionar uma sub-tabela abaixo dos cards atuais mostrando cada tipo de ingresso com sua meta e progresso (meta vs realizado), similar ao formato do funil
- No `FunnelKPISection`, as linhas BOFU (Vendas e Receita) continuam usando a meta geral (`ticket_type = null`)

### 6. `Goals.tsx` — exibir coluna "Lote"

Adicionar coluna na listagem mostrando o tipo de ingresso associado à meta (ou "Todos" quando for `null`).

## Resultado

O usuário poderá:
1. Criar meta "Ingressos VIP — S3" com `metric_key=tickets_sold`, `ticket_type="VIP"`, período da semana 3
2. Ver no dashboard de vendas uma tabela por lote mostrando meta vs realizado
3. Continuar usando metas gerais (sem filtro de lote) normalmente

