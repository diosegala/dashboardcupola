# Ritmo de vendas mais claro para quem lê

Os cálculos não mudam (ritmo atual = média dos últimos 10 dias úteis; necessário = pagantes que faltam ÷ dias úteis até a véspera; selo acima/no ritmo/abaixo). Muda só a forma de explicar no card.

## Hoje (confuso)
- "11,1 por dia útil" no centro sem dizer que é o ritmo atual nem de qual período.
- "15" solto em cima do arco, sem nome.
- "Precisa de 15" e "133 dias úteis" sem ligação com quantos ingressos faltam.
- Selo "Abaixo do ritmo" sem dizer quanto.

## Como fica
- Centro do arco: "11,1" com "vendidos/dia útil" embaixo.
- Marcador: "Meta 15" (em vez de só "15").
- Faixa de baixo, em duas colunas com rótulo:
  - **Ritmo atual** — 11,1 por dia útil · média dos últimos 10 dias úteis
  - **Ritmo necessário** — 15 por dia útil · 1.867 faltam ÷ 133 dias úteis
- Selo com a diferença: "Abaixo do ritmo · −3,9/dia" (ou "Acima do ritmo · +X/dia", "No ritmo", "Meta atingida").
- Comparativo com 2026 continua igual.
- Sem meta: mostra só "Ritmo atual" e o aviso "Defina a meta de pagantes na aba Metas".
- "i" simplificado: "Ritmo atual: média de pagantes por dia útil nos últimos 10 dias úteis. Ritmo necessário: pagantes que faltam divididos pelos dias úteis até a véspera do evento (sem fins de semana e feriados). Se o atual for menor que o necessário, a venda está abaixo do ritmo."

## Detalhes técnicos
- `PaceGauge.tsx`: nova prop `faltam` (pagantes que faltam, já calculado em `useCommercialMetrics` como `missing`; expor no retorno se ainda não estiver) e diferença `currentPace - requiredPace` no selo.
- `CommercialOverview.tsx`: passar `faltam` e montar o texto do selo com a diferença.
- `metricInfo.ts`: texto novo de "Ritmo de vendas".
- Conferir no navegador.
