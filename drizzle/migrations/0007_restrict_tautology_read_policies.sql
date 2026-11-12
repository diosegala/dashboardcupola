CREATE OR REPLACE FUNCTION public.has_dashboard_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_users WHERE user_id = auth.uid())
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_dashboard_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_dashboard_access() TO authenticated;

DROP POLICY IF EXISTS "Authenticated can view email_campaigns" ON public.email_campaigns;
CREATE POLICY "Dashboard users can view email_campaigns" ON public.email_campaigns FOR SELECT TO authenticated USING (public.has_dashboard_access());

DROP POLICY IF EXISTS "Authenticated can view site_analytics" ON public.site_analytics;
CREATE POLICY "Dashboard users can view site_analytics" ON public.site_analytics FOR SELECT TO authenticated USING (public.has_dashboard_access());

DROP POLICY IF EXISTS "Authenticated can view ga4_events" ON public.ga4_events;
CREATE POLICY "Dashboard users can view ga4_events" ON public.ga4_events FOR SELECT TO authenticated USING (public.has_dashboard_access());

DROP POLICY IF EXISTS "Authenticated can view ad_metrics" ON public.ad_metrics;
CREATE POLICY "Dashboard users can view ad_metrics" ON public.ad_metrics FOR SELECT TO authenticated USING (public.has_dashboard_access());

DROP POLICY IF EXISTS "Autenticados leem ligações" ON public.email_sale_links;
CREATE POLICY "Equipe do painel lê ligações" ON public.email_sale_links FOR SELECT TO authenticated USING (public.has_dashboard_access() AND NOT public.is_seller());

DROP POLICY IF EXISTS "Usuarios logados leem pessoas dos cupons" ON public.coupon_people;
CREATE POLICY "Equipe do painel lê pessoas dos cupons" ON public.coupon_people FOR SELECT TO authenticated USING (public.has_dashboard_access());