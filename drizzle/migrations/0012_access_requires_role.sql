CREATE OR REPLACE FUNCTION public.has_dashboard_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Sem função gravada, sem painel: estar ligado a um evento não basta.
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.can_see_event(_event_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin')
      OR (public.has_dashboard_access() AND (
            EXISTS (SELECT 1 FROM public.user_event_scope WHERE user_id = auth.uid() AND all_events)
         OR EXISTS (SELECT 1 FROM public.event_users WHERE event_id = _event_id AND user_id = auth.uid())
      ))
$function$;

CREATE OR REPLACE FUNCTION public.get_current_sympla_event_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.credentials->>'event_id'
  FROM public.integrations i
  WHERE i.name = 'sympla' AND public.has_dashboard_access()
$function$;