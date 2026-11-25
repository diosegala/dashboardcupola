ALTER TABLE public.event_batches
  ADD COLUMN IF NOT EXISTS price_standard numeric,
  ADD COLUMN IF NOT EXISTS price_vip numeric,
  ADD COLUMN IF NOT EXISTS price_visit numeric,
  ADD COLUMN IF NOT EXISTS price_standard_visit numeric,
  ADD COLUMN IF NOT EXISTS price_vip_visit numeric,
  ADD COLUMN IF NOT EXISTS price_group_standard numeric,
  ADD COLUMN IF NOT EXISTS price_group_vip numeric;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS presale_price numeric;