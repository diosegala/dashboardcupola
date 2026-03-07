

# Corrigir gráfico comparativo ano a ano

## Problemas

1. **Valores acumulados em vez de por semana**: O `groupByRelativeWeek` soma cumulativamente (`cumulative += quantity`). O usuário quer vendas **por semana**, não acumulado.

2. **Gráfico não funciona (apenas uma linha, eixo X quebrado)**: O Recharts usa `dataKey="weekLabel"` que repete "S1, S2, S3, S4, S1, S2..." — os labels duplicados confundem o Recharts e as `ReferenceLine` não funcionam corretamente. Precisamos de um `dataKey` único por ponto.

## Solução

Reescrever `YearOverYearChart.tsx`:

1. **Vendas por semana (não acumulado)**: Somar `quantity` por semana relativa sem acumular.

2. **DataKey único**: Usar `weekNum` (1, 2, 3...) como dataKey do eixo X em vez do label repetido "S1".

3. **Eixo X hierárquico funcional**:
   - Um único `XAxis` com `dataKey="weekNum"` e `tickFormatter` que retorna "S1", "S2", etc.
   - Usar `ReferenceLine` com `x={weekNum}` (numérico, único) para separar meses.
   - Labels de mês via `Label` dentro de cada `ReferenceLine`, ou um segundo `XAxis` com tick customizado que usa o index para verificar `isFirstOfMonth`.

4. **Tooltip** mantido com datas reais de ambos os eventos.

## Arquivo editado
- `src/components/dashboard/charts/YearOverYearChart.tsx`

