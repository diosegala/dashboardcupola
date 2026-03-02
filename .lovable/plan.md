

# Corrigir sincronizacao de metricas do RD Station

## Problema

A funcao `sync-rd-station` usa apenas o endpoint `/platform/emails` que retorna somente metadados das campanhas (nome, id, data de envio). As estatisticas de engajamento (enviados, aberturas, cliques) vem de um endpoint separado: `/platform/analytics/emails`.

Por isso, todos os campos `total_sent`, `total_opened`, `total_clicked`, `open_rate`, `click_rate` estao zerados no banco.

## Dados disponiveis na API de Analytics do RD Station

O endpoint `GET /platform/analytics/emails` retorna por campanha:
- `contacts_count` (total de contatos/enviados)
- `email_delivered_count`
- `email_bounced_count`
- `email_opened_count` (aberturas unicas)
- `email_clicked_count` (cliques unicos)
- `email_dropped_count`
- `email_unsubscribed_count`

**Importante:** Essa API so retorna dados a partir de agosto de 2021, e no plano Pro tem limite dos ultimos 45 dias.

## Solucao

### Atualizar a edge function `sync-rd-station/index.ts`

Apos buscar a lista de campanhas em `/platform/emails`, fazer uma segunda chamada ao endpoint `/platform/analytics/emails` para obter as estatisticas de cada campanha. O fluxo sera:

1. Buscar lista de campanhas via `/platform/emails` (ja existente)
2. Para cada campanha (ou em lote), buscar estatisticas via `/platform/analytics/emails/{campaign_id}`
3. Mapear os campos corretamente:
   - `contacts_count` -> `total_sent`
   - `email_opened_count` -> `total_opened`
   - `email_clicked_count` -> `total_clicked`
   - `email_unsubscribed_count` -> `unsubscribes`
   - Calcular `open_rate` = opened / sent
   - Calcular `click_rate` = clicked / sent
4. Respeitar rate limits com delays entre chamadas individuais

### Cuidados

- Adicionar throttle (delay de 1-2s) entre cada chamada de estatisticas para evitar 429
- Tratar campanhas sem estatisticas disponibilizadas (manter zeros)
- Manter o fallback: se a API de analytics falhar, salvar a campanha sem metricas em vez de abortar tudo

### Arquivos alterados
- `supabase/functions/sync-rd-station/index.ts`

Nenhuma alteracao de banco necessaria -- as colunas ja existem.

