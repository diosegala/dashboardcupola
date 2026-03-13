CREATE TABLE public.ga4_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  event_name text NOT NULL,
  event_count integer DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(date, event_name)
);

ALTER TABLE public.ga4_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ga4_events"
  ON public.ga4_events FOR SELECT TO authenticated USING (true);