

# Alterar agrupamento de Canal para Origem nas tabelas do GA4

## Problema
A Edge Function `sync-google-analytics` usa a dimensao `sessionDefaultChannelGroup` do GA4, que retorna canais como "Organic Search", "Direct", "Paid Search". O correto para o dashboard e usar `sessionSource`, que retorna origens como "google", "facebook", "(direct)", "bing".

## Mudancas

### 1. Edge Function `sync-google-analytics`
- Trocar a dimensao `sessionDefaultChannelGroup` por `sessionSource` na chamada de traffic sources (linha 229)
- Renomear o campo `channel` para `source` no objeto salvo no JSONB `traffic_sources`

### 2. Frontend `MarketingSection.tsx`
- Atualizar a agregacao de `traffic_sources` para usar o campo `source` em vez de `channel`
- Ajustar o label de fallback de `(unknown)` para fontes sem nome

### 3. Frontend `SourceBreakdownTable.tsx`
- Verificar se o componente usa o campo `channel` para exibir o nome da linha e atualizar para `source`

### Observacao
Apos o deploy, sera necessario re-sincronizar o Google Analytics para que os dados sejam regravados com a nova dimensao de origem.

