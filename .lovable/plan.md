

# Trocar tabelas por graficos de barras horizontais (Top 10 origens)

## Mudanca
Substituir a visualizacao em tabela do componente `SourceBreakdownTable` por um grafico de barras horizontais usando Recharts (ja instalado no projeto).

## Detalhe tecnico
No arquivo `src/components/dashboard/SourceBreakdownTable.tsx`:

- Remover imports de Table e substituir por imports do Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Cell`)
- Manter a mesma interface de props (nao precisa alterar `MarketingSection`)
- Renderizar um `BarChart` com `layout="vertical"`:
  - YAxis mostrando os nomes das origens (truncados se necessario)
  - XAxis mostrando os valores
  - Barras horizontais com cores do tema
  - Tooltip formatado com a funcao `formatValue`
- Manter o Card wrapper com titulo
- Manter o estado vazio ("Sem dados") quando nao houver dados
- Altura fixa proporcional ao numero de itens (ex: 40px por barra)

Nenhum outro arquivo precisa ser alterado pois a interface do componente permanece a mesma.

