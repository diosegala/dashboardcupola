
CREATE UNIQUE INDEX ad_metrics_source_date_campaign_id_idx 
  ON public.ad_metrics (source, date, campaign_id);
