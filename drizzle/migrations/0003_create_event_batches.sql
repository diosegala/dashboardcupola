CREATE TABLE public.event_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_batches TO authenticated;
GRANT ALL ON public.event_batches TO service_role;
ALTER TABLE public.event_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver lotes do evento" ON public.event_batches FOR SELECT TO authenticated USING (public.can_see_event(event_id));
CREATE POLICY "Admins gerenciam lotes" ON public.event_batches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.event_batches_valida()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'O término do lote não pode ser antes do início';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER event_batches_valida BEFORE INSERT OR UPDATE ON public.event_batches FOR EACH ROW EXECUTE FUNCTION public.event_batches_valida();