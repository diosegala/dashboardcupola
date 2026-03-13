-- First set any existing NULLs to empty string
UPDATE public.ad_metrics SET ad_set_id = '' WHERE ad_set_id IS NULL;
UPDATE public.ad_metrics SET campaign_id = '' WHERE campaign_id IS NULL;

-- Set defaults so future inserts never get NULL
ALTER TABLE public.ad_metrics ALTER COLUMN ad_set_id SET DEFAULT '';
ALTER TABLE public.ad_metrics ALTER COLUMN ad_set_id SET NOT NULL;
ALTER TABLE public.ad_metrics ALTER COLUMN campaign_id SET DEFAULT '';
ALTER TABLE public.ad_metrics ALTER COLUMN campaign_id SET NOT NULL;

-- Replace expression index with plain index
DROP INDEX IF EXISTS public.ad_metrics_source_date_campaign_adset_idx;
CREATE UNIQUE INDEX ad_metrics_source_date_campaign_adset_idx ON public.ad_metrics USING btree (source, date, campaign_id, ad_set_id);