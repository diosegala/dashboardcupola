

# Corrigir conflito de indices duplicados na tabela ad_metrics

## Problema

A tabela `ad_metrics` tem **3 indices unicos** que se sobrepoem. A migration anterior criou o novo indice `(source, date, campaign_id)` mas nao removeu os antigos:

- `ad_metrics_source_date_adset` -- (source, date, ad_set_id)
- `ad_metrics_source_campaign_id_ad_set_id_date_key` -- (source, campaign_id, ad_set_id, date)
- `ad_metrics_source_date_campaign_id_idx` -- (source, date, campaign_id) (novo)

Quando o sync-meta faz upsert com `onConflict: "source,date,campaign_id"`, o Postgres resolve o conflito nesse indice, mas a linha resultante pode violar um dos outros dois indices antigos, gerando o erro.

## Solucao

### Migration SQL
Remover os dois indices antigos que nao sao mais necessarios:

```text
DROP INDEX IF EXISTS ad_metrics_source_date_adset;
DROP INDEX IF EXISTS ad_metrics_source_campaign_id_ad_set_id_date_key;
```

### Atualizar sync-google-ads
O Google Ads tambem usa `onConflict: "source,date,ad_set_id"` referenciando o indice antigo. Precisa ser atualizado para usar `"source,date,campaign_id"` e garantir que os dados populem corretamente `campaign_id`. Tambem precisa popular `link_clicks` e `purchases` (com default 0) para compatibilidade.

### Arquivos alterados
- Migration SQL (nova) -- drop dos indices antigos
- `supabase/functions/sync-google-ads/index.ts` -- atualizar onConflict para `source,date,campaign_id`

