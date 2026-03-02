ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS link_clicks integer DEFAULT 0;
ALTER TABLE public.ad_metrics ADD COLUMN IF NOT EXISTS purchases integer DEFAULT 0;