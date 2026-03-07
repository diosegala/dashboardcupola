

# Corrigir gráfico comparativo ano a ano

## Problemas identificados

1. **Apenas uma linha aparece**: A query `useTicketSalesAllEvents` retorna no máximo 1000 linhas (limite padrão do Supabase), mas existem 4037 registros no total (3448 do evento anterior + 589 do atual). O evento anterior é retornado primeiro (ordered by `sold_at`), consumindo as 1000 linhas, e o evento atual fica sem dados — ou vice-versa.

2. **Labels do eixo X**: Atualmente mostra "Sem 1", "Sem 2", etc. O usuário quer ver o intervalo de datas real de cada semana (ex: "04/11 - 10/11").

## Alterações

### 1. `src/hooks/useDashboardData.ts` — corrigir limite de 1000 linhas

Na função `useTicketSalesAllEvents`, adicionar paginação ou usar `range()` para buscar todos os registros. A abordagem mais simples: fazer duas queries separadas (uma por event_id) e combinar os resultados, ou usar `.range(0, 10000)` para garantir que todos os dados sejam retornados.

### 2. `src/components/dashboard/charts/YearOverYearChart.tsx` — labels com datas

Alterar `groupByRelativeWeek` para retornar também as datas de início e fim de cada semana relativa. No eixo X, exibir no formato "dd/MM - dd/MM" (ex: "04/11 - 10/11") em vez de "Sem 1".

Cada ponto do gráfico terá um label como:
- Evento Atual: "16/05 - 22/05"  
- Evento Anterior: "04/11 - 10/11"

Como as datas reais são diferentes entre os eventos, o label do eixo X mostrará a semana relativa com as datas de **ambos** os eventos no tooltip, e o eixo X mostrará "Sem 1 (dd/MM)", usando as datas do evento atual como referência principal.

### Arquivos editados
- `src/hooks/useDashboardData.ts`
- `src/components/dashboard/charts/YearOverYearChart.tsx`

