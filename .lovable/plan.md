

# Dashboard GA4: Cards de Sessoes, Conversoes e Tabelas por Origem

## Visao geral
Expandir a secao Google Analytics do dashboard com:
- Card de **Sessoes** (ja existe)
- Card de **Conversoes** (novo)
- 4 tabelas de metricas por origem: Sessoes/Origem, Conversoes/Origem, Tempo medio de engajamento/Origem, Taxa de rejeicao/Origem

## Mudancas necessarias

### 1. Banco de dados
Adicionar coluna `conversions` (integer, default 0) na tabela `site_analytics`.

Expandir o formato do JSONB `traffic_sources` para incluir mais metricas por origem:
```text
Formato atual:   { channel, sessions }
Formato novo:    { channel, sessions, conversions, avg_engagement_time, bounce_rate }
```
Nao precisa de nova coluna para isso -- o JSONB ja suporta campos adicionais.

### 2. Edge Function `sync-google-analytics`
- Adicionar metrica `conversions` na chamada de metricas diarias
- Alterar a chamada de traffic sources para incluir 4 metricas por dimensao (sessionDefaultChannelGroup): sessions, conversions, averageSessionDuration, bounceRate
- Salvar os novos campos no upsert

### 3. Frontend - Novos componentes

**SourceBreakdownTable**: componente reutilizavel que recebe titulo, dados agregados por origem e a chave da metrica a exibir. Renderiza uma tabela simples (Origem | Valor).

### 4. Frontend - MarketingSection
- Trocar card "Novos Usuarios" por card de **Conversoes** 
- Adicionar 4 tabelas abaixo dos cards existentes na secao Google Analytics:
  - Sessoes por Origem
  - Conversoes por Origem
  - Tempo medio de engajamento por Origem
  - Taxa de rejeicao por Origem

Os dados por origem serao agregados no frontend a partir dos registros `traffic_sources` do periodo selecionado, somando valores por canal.

## Detalhes tecnicos

### Agregacao de traffic_sources no frontend
Como `traffic_sources` e um JSONB por dia, ao selecionar um periodo o frontend precisa:
1. Iterar sobre cada registro de `site_analytics` no periodo
2. Para cada registro, iterar sobre o array `traffic_sources`
3. Agrupar por `channel`, somando sessions/conversions e fazendo media ponderada de bounce_rate e avg_engagement_time

### Metrica de conversoes no GA4
A metrica `conversions` no GA4 Data API conta eventos marcados como conversao (key events). Se a propriedade GA4 nao tiver key events configurados, o valor retornara 0.

### Sequencia de implementacao
1. Migrar banco (adicionar coluna `conversions`)
2. Atualizar Edge Function e fazer deploy
3. Criar componente `SourceBreakdownTable`
4. Atualizar `MarketingSection` com novos cards e tabelas

