

# Trocar gráficos por tabelas para Tempo de Engajamento e Taxa de Rejeição

## O que muda

Os dois componentes `SourceBreakdownTable` que exibem "Tempo Médio de Engajamento" e "Taxa de Rejeição" atualmente usam gráficos de barras horizontais (Recharts). Vamos substituí-los por tabelas HTML simples, mantendo os outros dois (Sessões e Conversões) como gráficos.

## Implementação

### Novo componente: `src/components/dashboard/SourceBreakdownDataTable.tsx`

- Componente de tabela simples usando os componentes `Table` existentes do projeto
- Mesma interface do `SourceBreakdownTable` (title, data, metricKey, formatValue)
- Exibe top 10 origens ordenadas pelo valor, com duas colunas: Origem e Valor
- Estilo consistente com as outras tabelas do dashboard (ex: `DemandGenTable`)

### `src/components/dashboard/MarketingSection.tsx`

- Substituir as duas chamadas de `SourceBreakdownTable` para `avg_engagement_time` e `bounce_rate` pelo novo `SourceBreakdownDataTable`
- Sessões e Conversões continuam como gráficos de barras

