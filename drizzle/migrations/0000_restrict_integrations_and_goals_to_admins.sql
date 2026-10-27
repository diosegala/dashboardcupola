DROP POLICY IF EXISTS "Authenticated users can view integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can manage integrations" ON public.integrations;
CREATE POLICY "Admins can manage integrations" ON public.integrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.integrations FROM anon;

CREATE OR REPLACE FUNCTION public.get_integrations_status()
RETURNS TABLE (name text, status text, last_synced_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.name,
         CASE WHEN NOT i.is_active THEN 'inactive' ELSE i.sync_status END,
         i.last_synced_at
  FROM public.integrations i
  WHERE public.has_role(auth.uid(), 'admin')
$$;
REVOKE ALL ON FUNCTION public.get_integrations_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_integrations_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_current_sympla_event_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.credentials->>'event_id'
  FROM public.integrations i
  WHERE i.name = 'sympla' AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_current_sympla_event_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_sympla_event_id() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert goals" ON public.goals;
DROP POLICY IF EXISTS "Authenticated users can update goals" ON public.goals;
DROP POLICY IF EXISTS "Authenticated users can delete goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can manage goals" ON public.goals;
CREATE POLICY "Admins can manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));