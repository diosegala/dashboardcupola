
# Adicionar atalhos de periodo e agrupar em dropdown

## Verificacao: Filtro de periodo no GA
O filtro de periodo JA esta sendo aplicado aos dados do Google Analytics. A query `useSiteAnalytics` filtra por `.gte("date", range.from)` e `.lte("date", range.to)`, entao os dados de sessoes, conversoes e origens respeitam o periodo selecionado.

## Mudanca: Refatorar o PeriodSelector

Arquivo: `src/components/dashboard/PeriodSelector.tsx`

Substituir o botao "Todo periodo" isolado por um **DropdownMenu** com as seguintes opcoes de atalho:

| Label | Logica |
|---|---|
| Ultimos 7 dias | `subDays(today, 6)` ate `today` |
| Ultimos 30 dias | `subDays(today, 29)` ate `today` |
| Este mes | `startOfMonth(today)` ate `endOfMonth(today)` |
| Mes passado | `startOfMonth(subMonths(today, 1))` ate `endOfMonth(subMonths(today, 1))` |
| Todo o periodo | `2020-01-01` ate `today` |

O botao do dropdown exibira o icone de calendario + o intervalo de datas formatado (como ja esta hoje). Ao selecionar um atalho, o range sera atualizado automaticamente. O calendario continua acessivel como ultima opcao ou como area abaixo dos atalhos dentro do mesmo popover.

### Estrutura visual
- Um unico botao que mostra o periodo atual (ex: "01 fev - 27 fev 2026")
- Ao clicar, abre um Popover com:
  - Lista de atalhos (botoes/links) no topo
  - Separador
  - Calendario de selecao de intervalo personalizado abaixo

### Detalhes tecnicos
- Importar `subDays`, `subMonths`, `startOfMonth`, `endOfMonth` do `date-fns`
- Remover a prop `onSelectAllTime` (a logica ficara interna ao componente)
- Atualizar `Index.tsx` para remover a prop `onSelectAllTime`
- Manter o componente no mesmo arquivo, apenas refatorando o conteudo
