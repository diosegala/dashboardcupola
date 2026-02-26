CREATE UNIQUE INDEX IF NOT EXISTS ad_metrics_source_date_adset
ON ad_metrics (source, date, COALESCE(ad_set_id, ''));