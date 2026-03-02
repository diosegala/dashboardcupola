

# Atualizar Meta Ads: metricas solicitadas pelo marketing

## Problema

O dashboard atual mostra metricas basicas do Meta (impressoes, cliques totais, gasto, CTR). O time de marketing precisa de metricas mais especificas: cliques no link, conversoes/compras do pixel, e taxa de conversao -- dados que vem do campo `actions` da API do Meta, que nao esta sendo consultado.

## O que muda

### 1. Adicionar colunas no banco de dados
Criar duas novas colunas na tabela `ad_metrics`:
- `link_clicks` (integer, default 0) -- cliques no link especificamente
- `purchases` (integer, default 0) -- conversoes de compra do pixel

Tambem precisamos trocar o indice unico de `(source, date, ad_set_id)` para `(source, date, campaign_id)` pois os dados passam a ser agregados por campanha.

### 2. Atualizar a edge function sync-meta
- Mudar `level` de "adset" para "campaign"
- Adicionar `actions` ao campo `fields` da API
- Extrair `link_click` e `purchase` do array `actions` retornado
- Usar `campaign_id` como chave do upsert em vez de `ad_set_id`
- Calcular CPC (spend / link_clicks) e CTR (link_clicks / impressions) com base nos cliques no link

### 3. Atualizar o dashboard (MarketingSection)
Trocar os 4 cards atuais do Meta por 7 cards alinhados com o pedido:

| Card | Dado |
|------|------|
| Campanhas | contagem de campaign_ids unicos |
| Impressoes | soma de impressions |
| Cliques no Link | soma de link_clicks |
| CPC | gasto total / cliques no link |
| CTR | cliques no link / impressoes |
| Compras (Pixel) | soma de purchases |
| Taxa de Conversao | compras / cliques no link |

### 4. Atualizar opcoes de metas (goalMetrics)
Adicionar novas opcoes: `meta_link_clicks`, `meta_purchases`, `meta_conversion_rate`.

## Detalhes tecnicos

### Migration SQL
```text
ALTER TABLE ad_metrics ADD COLUMN link_clicks integer DEFAULT 0;
ALTER TABLE ad_metrics ADD COLUMN purchases integer DEFAULT 0;
DROP INDEX IF EXISTS ad_metrics_source_date_ad_set_id_idx;
CREATE UNIQUE INDEX ad_metrics_source_date_campaign_id_idx 
  ON ad_metrics (source, date, campaign_id);
```

### Edge function (sync-meta/index.ts)
- fields: adicionar `actions`
- level: `campaign`
- Parser de actions:
```text
link_clicks = actions.find(a => a.action_type === 'link_click')?.value || 0
purchases = actions.find(a => a.action_type === 'purchase')?.value || 0
```
- onConflict: `source,date,campaign_id`

### Arquivos alterados
- `supabase/functions/sync-meta/index.ts`
- `src/components/dashboard/MarketingSection.tsx`
- `src/lib/goalMetrics.ts`
- Migration SQL (nova)

