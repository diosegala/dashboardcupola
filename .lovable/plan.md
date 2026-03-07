

# Comparação Ano a Ano — Eixo X por Mês e Semana

## Problema

As semanas relativas (Sem 1, Sem 2...) ou datas absolutas não funcionam bem como eixo X porque as datas dos dois eventos não coincidem. O gráfico fica confuso e difícil de ler.

## Solução proposta: Eixo X com dois níveis — Mês + Semana do mês

Usar um eixo X hierárquico com **"S1", "S2", "S3", "S4"** (semanas dentro do mês) agrupadas sob rótulos de mês (**"Jan", "Fev", "Mar"...**). Cada evento terá seu próprio "calendário relativo" começando no Mês 1 / Semana 1 a partir da primeira venda.

```text
Eixo X:
  S1 S2 S3 S4 | S1 S2 S3 S4 | S1 S2 S3 S4 | ...
     Mês 1    |    Mês 2    |    Mês 3    | ...
```

O tooltip ao passar o mouse mostrará as datas reais de cada evento para aquela semana:
- **Evento Atual:** 450 ingressos (12/05 - 18/05/2026)
- **Evento Anterior:** 380 ingressos (08/11 - 14/11/2025)

Assim o usuário compara ritmo de vendas no mesmo "momento relativo" da jornada de vendas (mês 3, semana 2 = ambos estavam no mesmo estágio).

## Alterações

### 1. `src/components/dashboard/charts/YearOverYearChart.tsx`

- Alterar `groupByRelativeWeek` para calcular **mês relativo** e **semana dentro do mês** a partir da primeira venda
- Cada ponto terá: `monthLabel` ("Mês 1", "Mês 2"...), `weekInMonth` (S1-S4/S5), `total` acumulado, `weekStart`/`weekEnd` reais
- Usar **dois eixos XAxis** no Recharts:
  - XAxis principal: `xAxisId="week"` com labels "S1", "S2", etc.
  - XAxis secundário: `xAxisId="month"` com labels "Mês 1", "Mês 2", etc. (usando `ReferenceLine` ou um segundo `XAxis` com `tick` customizado que só renderiza na primeira semana de cada mês)
- Tooltip customizado mostrando datas reais de ambos os eventos
- Manter as duas linhas (atual sólida, anterior tracejada)

### Detalhes técnicos

Recharts suporta múltiplos `XAxis` com `xAxisId`. O eixo de mês usará um tick customizado que só renderiza o label na primeira semana de cada mês, criando o efeito de agrupamento visual. Separadores verticais sutis marcarão a transição entre meses.

### Arquivos editados
- `src/components/dashboard/charts/YearOverYearChart.tsx`

