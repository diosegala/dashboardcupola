ALTER TABLE public.ad_metrics
  ADD COLUMN IF NOT EXISTS messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_to_cart integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remarketing_qualified integer DEFAULT 0;