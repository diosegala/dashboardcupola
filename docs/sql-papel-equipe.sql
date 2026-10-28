-- Papel "Equipe de vendas": vê só o ranking de cupons e a lista de compradores dos eventos liberados para ela.
-- Rodar inteiro no editor SQL do Lovable. Não apaga nada; só cria o papel, a tabela de cupons e regras novas.

-- 1. Novo papel
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';

-- Compara como texto para funcionar no mesmo script em que o papel é criado.
CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'seller')
$$;
REVOKE ALL ON FUNCTION public.is_seller() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_seller() TO authenticated;

-- 2. Cupom de cada pessoa da equipe (ex.: EMILLYN5). Só administradores cadastram; cada pessoa lê o seu.
CREATE TABLE public.team_coupons (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code text NOT NULL UNIQUE CHECK (coupon_code = upper(btrim(coupon_code)) AND coupon_code <> ''),
  PRIMARY KEY (user_id, coupon_code)
);
ALTER TABLE public.team_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own team coupons" ON public.team_coupons
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage team coupons" ON public.team_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.team_coupons FROM anon;

-- 3. A equipe não lê marketing, metas, integrações nem a base própria.
-- Regras restritivas somam-se às que já existem: nada do que admin e viewer veem muda.
CREATE POLICY "Sellers cannot read ad_metrics" ON public.ad_metrics AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read deals" ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read email_campaigns" ON public.email_campaigns AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read ga4_events" ON public.ga4_events AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read site_analytics" ON public.site_analytics AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read integrations" ON public.integrations AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot read event_history" ON public.event_history AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
CREATE POLICY "Sellers cannot touch goals" ON public.goals AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_seller()) WITH CHECK (NOT public.is_seller());

-- 4. Lista de compradores para a equipe: só nome, e-mail, telefone, empresa, situação e eventos.
-- CPF nunca sai daqui (documento só vai quando é CNPJ). Vale para o evento liberado e para o anterior a ele.
CREATE OR REPLACE FUNCTION public.get_buyer_rows(p_slug text)
RETURNS TABLE (sympla_order_id text, participant_data jsonb, order_data jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sympla text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_seller()) THEN
    RETURN;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE (e.slug = p_slug OR e.previous_event_slug = p_slug) AND public.can_see_event(e.id)
  ) THEN
    RETURN;
  END IF;

  SELECT e.sympla_event_id INTO v_sympla FROM public.events e WHERE e.slug = p_slug;

  RETURN QUERY
  WITH brutos AS (
    SELECT h.data->>'sympla_order_id' AS oid, h.data->'participant_data' AS p, h.data->'order_data' AS o, 1 AS prioridade
    FROM public.event_history h
    WHERE h.event_key = p_slug AND h.source_table = 'ticket_sales_details'
    UNION ALL
    SELECT d.sympla_order_id, d.participant_data::jsonb, d.order_data::jsonb, 0
    FROM public.ticket_sales_details d
    WHERE v_sympla IS NOT NULL
      AND (d.participant_data->>'event_id' = v_sympla OR d.order_data->>'event_id' = v_sympla)
  ),
  unicos AS (
    SELECT DISTINCT ON (oid) * FROM brutos WHERE oid IS NOT NULL ORDER BY oid, prioridade
  )
  SELECT
    u.oid,
    CASE WHEN u.p IS NULL OR jsonb_typeof(u.p) <> 'object' THEN NULL ELSE jsonb_build_object(
      'first_name', u.p->'first_name',
      'last_name', u.p->'last_name',
      'email', u.p->'email',
      'order_id', u.p->'order_id',
      'order_status', u.p->'order_status',
      'custom_form', COALESCE((
        SELECT jsonb_agg(f) FROM jsonb_array_elements(COALESCE(u.p->'custom_form', '[]'::jsonb)) f
        WHERE (f->>'name') ~* '(whats|telefone|celular|^empresa$|nome da empresa)'
           OR ((f->>'name') ~* '(cpf|cnpj)' AND length(regexp_replace(COALESCE(f->>'value', ''), '\D', '', 'g')) = 14)
      ), '[]'::jsonb)
    ) END,
    CASE WHEN u.o IS NULL OR jsonb_typeof(u.o) <> 'object' THEN NULL ELSE jsonb_build_object(
      'id', u.o->'id',
      'buyer_first_name', u.o->'buyer_first_name',
      'buyer_last_name', u.o->'buyer_last_name',
      'buyer_email', u.o->'buyer_email',
      'order_status', u.o->'order_status',
      'order_date', u.o->'order_date',
      'invoice_info', jsonb_build_object(
        'client_name', u.o->'invoice_info'->'client_name',
        'doc_number', CASE WHEN length(regexp_replace(COALESCE(u.o->'invoice_info'->>'doc_number', ''), '\D', '', 'g')) = 14
                           THEN u.o->'invoice_info'->'doc_number' END
      )
    ) END
  FROM unicos u;
END;
$$;
REVOKE ALL ON FUNCTION public.get_buyer_rows(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buyer_rows(text) TO authenticated;
