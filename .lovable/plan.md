

# Gráfico de Barras — Geração de Demanda por Dia

## O que será feito

Criar um gráfico de barras agrupadas mostrando os 4 eventos de Geração de Demanda (`add_to_cart`, `botao_sympla`, `botao_tabela`, `mais_infos_tp_mobile`) ao longo do tempo, com uma barra por evento por dia.

## Etapas

### 1. Novo componente `DemandGenByDayChart.tsx`

Criar `src/components/dashboard/charts/DemandGenByDayChart.tsx`:
- Recebe `ga4Events: any[]`
- Agrupa por `date` e pivota os 4 eventos em colunas
- Usa `BarChart` do Recharts com barras agrupadas (uma cor por evento)
- Eixo X: datas formatadas `dd/MM`
- Eixo Y: contagem de eventos
- Legenda com os labels amigáveis
- Tooltip mostrando valores por evento

### 2. Integrar no `MarketingSection.tsx`

Renderizar o `DemandGenByDayChart` logo abaixo do `DemandGenTable`, dentro da seção "Site (Google Analytics)".

### Não é necessário

- Alterações no banco, edge function ou hooks (dados já disponíveis via `ga4Events`)

