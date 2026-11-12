CREATE OR REPLACE FUNCTION public.can_see_event(_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer')
      OR EXISTS (SELECT 1 FROM public.event_users WHERE event_id = _event_id AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_see_crm_account(_account text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer')
      OR EXISTS (SELECT 1 FROM public.sponsorship_config sc
        WHERE sc.crm_account = _account AND public.can_see_event(sc.event_id))
$$;