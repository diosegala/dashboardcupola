CREATE OR REPLACE FUNCTION public.can_see_event(_event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_dashboard_access()
$function$;