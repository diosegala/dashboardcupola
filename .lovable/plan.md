

# Funil de KPIs com breakdown semanal lado a lado

## Visão geral

Reformular o `FunnelKPISection` para exibir colunas de meta/realizado por semana, lado a lado, além do período total — replicando o formato da planilha do diretor de marketing.

## Layout da tabela

```text
┌──────┬────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────┐
│Etapa │ Objetivo   │ Período Total     │ S1 (26/02-04/03)  │ S2 (05/03-11/03)  │ S3 (12/03-18/03)  │
│      │            │ Meta  │ Realizado │ Meta  │ Realizado │ Meta  │ Realizado │ Meta  │ Realizado │
├──────┼────────────┼───────┼───────────┼───────┼───────────┼───────┼───────────┼───────┼───────────┤
│ TOFU │ Engajam.   │  300  │   209     │  50   │    48     │  100  │    52     │  150  │   101     │
│ ...  │ ...        │       │           │       │           │       │           │       │           │
└──────┴────────────┴───────┴───────────┴───────┴───────────┴───────┴───────────┴───────┴───────────┘
```

- Scroll horizontal para acomodar muitas semanas
- Colunas fixas (Etapa + Objetivo) à esquerda
- Período total sempre visível como primeira coluna de dados
- Semanas numeradas (S1, S2...) com datas no sub-header

## Lógica de semanas

1. A partir do `range` selecionado no dashboard, dividir o período em semanas (seg–dom)
2. Para cada semana, filtrar `adMetrics`, `emailCampaigns` e `tickets` pela data correspondente
3. Calcular o realizado de cada métrica do funil por semana
4. Buscar a meta correspondente a cada semana via `findGoal(goals, metricKey, weekRange)`

## Alterações

### 1. `FunnelKPISection.tsx` — reformular componente

- Calcular array de semanas a partir do `range` (usando `startOfWeek`/`endOfWeek` com `weekStartsOn: 1`)
- Para cada semana, filtrar os dados por data e calcular os valores realizados
- Para o período total, usar os dados como estão (já filtrados pelo range)
- Renderizar header com colspan para cada período (total + semanas)
- Colorir células: verde quando realizado >= meta, vermelho quando < meta (opcional, como na planilha)
- Linha de totais no rodapé da tabela

### 2. `GoalFormDialog.tsx` — facilitar criação de metas semanais

Adicionar atalhos de período ao formulário:
- Botão "Semana" que ao ser clicado, mostra um seletor de semana (número da semana no ano) e preenche automaticamente `period_start` (segunda) e `period_end` (domingo)
- Botão "Mês" que preenche o mês inteiro
- Manter a opção de datas livres para flexibilidade

### 3. Página `Goals.tsx` — exibição melhorada

Adicionar coluna "Tipo" que indica se a meta é semanal (~7 dias) ou mensal (~28-31 dias), derivado automaticamente da diferença entre `period_start` e `period_end`.

## Detalhes técnicos

- Funções auxiliares: `getWeeksInRange(from, to)` retorna `{ label: string, from: Date, to: Date }[]`
- Filtro de dados por semana: comparar `date` (ad_metrics), `sent_at` (email_campaigns), `sold_at` (tickets) com os limites de cada semana
- A barra de progresso (%) será mantida apenas na coluna do período total para não sobrecarregar visualmente
- `sticky` CSS nas 2 primeiras colunas (Etapa + Objetivo) para manter contexto durante scroll horizontal

