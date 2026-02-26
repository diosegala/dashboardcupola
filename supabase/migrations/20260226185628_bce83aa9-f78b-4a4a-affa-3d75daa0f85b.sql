DROP INDEX IF EXISTS ad_metrics_source_date_adset;
CREATE UNIQUE INDEX ad_metrics_source_date_adset
ON ad_metrics (source, date, ad_set_id);
