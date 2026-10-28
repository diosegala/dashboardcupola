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

-- 4. Contatos viram chaves secretas: e-mail e telefone nunca chegam à tela da equipe.
-- A chave serve para juntar a mesma pessoa entre eventos e para achar alguém quando a equipe digita
-- um e-mail ou telefone que já conhece. Sem a senha interna abaixo, a chave não pode ser revertida.
CREATE TABLE public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL
);
-- Sem nenhuma regra de leitura: ninguém lê pela API, só as funções abaixo.
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_secrets FROM anon, authenticated;
INSERT INTO public.app_secrets (key, value)
VALUES ('contact_pepper', gen_random_uuid()::text || gen_random_uuid()::text);

-- kind 'e' = e-mail, 'p' = telefone. Mesma normalização do painel (telefone sem 55, últimos 11 dígitos).
CREATE OR REPLACE FUNCTION public.contact_key(kind text, v text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text;
  pepper text;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF kind = 'e' THEN
    n := lower(btrim(v));
    IF position('@' IN n) = 0 THEN RETURN NULL; END IF;
  ELSE
    n := regexp_replace(v, '\D', '', 'g');
    IF n LIKE '55%' AND length(n) >= 12 THEN n := substr(n, 3); END IF;
    IF length(n) < 10 THEN RETURN NULL; END IF;
    n := right(n, 11);
  END IF;
  SELECT s.value INTO pepper FROM public.app_secrets s WHERE s.key = 'contact_pepper';
  RETURN '#' || encode(sha256(convert_to(pepper || kind || n, 'UTF8')), 'hex');
END;
$$;
REVOKE ALL ON FUNCTION public.contact_key(text, text) FROM PUBLIC, anon, authenticated;

-- Busca da equipe: devolve só as chaves do que ela mesma digitou.
CREATE OR REPLACE FUNCTION public.contact_search_keys(p_term text)
RETURNS TABLE (email_key text, phone_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.contact_key('e', p_term), public.contact_key('p', p_term)
  WHERE auth.uid() IS NOT NULL AND (public.has_role(auth.uid(), 'admin') OR public.is_seller())
$$;
REVOKE ALL ON FUNCTION public.contact_search_keys(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_search_keys(text) TO authenticated;

-- 5. Lista de compradores para a equipe: nome, empresa, cupom, situação e eventos.
-- Sem CPF (documento só vai quando é CNPJ) e sem e-mail ou telefone (só as chaves). Vale para o evento liberado e o anterior.
CREATE OR REPLACE FUNCTION public.get_buyer_rows(p_slug text)
RETURNS TABLE (sympla_order_id text, participant_data jsonb, order_data jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sympla text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_seller()) THEN
    RETURN;
  END IF;
  -- A equipe lê o evento liberado para ela e qualquer evento CUPOLA que terminou antes dele (para a recorrência).
  IF NOT public.has_role(auth.uid(), 'admin') AND NOT EXISTS (
    SELECT 1 FROM public.events alvo
    JOIN public.events e ON public.can_see_event(e.id) AND e.end_date >= alvo.end_date
    WHERE alvo.slug = p_slug
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
  ),
  -- Cupom de cada ingresso: das vendas atuais e das guardadas na base própria.
  cupons AS (
    SELECT DISTINCT ON (oid) oid, cupom FROM (
      SELECT ts.sympla_order_id AS oid, ts.coupon_code AS cupom, 0 AS prioridade
      FROM public.ticket_sales ts
      WHERE v_sympla IS NOT NULL AND ts.event_id = v_sympla AND ts.coupon_code IS NOT NULL
      UNION ALL
      SELECT h.data->>'sympla_order_id', h.data->>'coupon_code', 1
      FROM public.event_history h
      WHERE h.event_key = p_slug AND h.source_table = 'ticket_sales' AND h.data->>'coupon_code' IS NOT NULL
    ) c ORDER BY oid, prioridade
  )
  SELECT
    u.oid,
    CASE WHEN u.p IS NULL OR jsonb_typeof(u.p) <> 'object' THEN NULL ELSE jsonb_build_object(
      'coupon', c.cupom,
      'first_name', u.p->'first_name',
      'last_name', u.p->'last_name',
      'email', public.contact_key('e', u.p->>'email'),
      'order_id', u.p->'order_id',
      'order_status', u.p->'order_status',
      'custom_form', COALESCE((
        SELECT jsonb_agg(
          CASE WHEN (f->>'name') ~* '(whats|telefone|celular)'
               THEN jsonb_build_object('name', f->'name', 'value', public.contact_key('p', f->>'value'))
               ELSE f END
        )
        FROM jsonb_array_elements(COALESCE(u.p->'custom_form', '[]'::jsonb)) f
        WHERE (f->>'name') ~* '(whats|telefone|celular|^empresa$|nome da empresa)'
           OR ((f->>'name') ~* '(cpf|cnpj)' AND length(regexp_replace(COALESCE(f->>'value', ''), '\D', '', 'g')) = 14)
      ), '[]'::jsonb)
    ) END,
    CASE WHEN u.o IS NULL OR jsonb_typeof(u.o) <> 'object' THEN NULL ELSE jsonb_build_object(
      'id', u.o->'id',
      'buyer_first_name', u.o->'buyer_first_name',
      'buyer_last_name', u.o->'buyer_last_name',
      'buyer_email', public.contact_key('e', u.o->>'buyer_email'),
      'order_status', u.o->'order_status',
      'order_date', u.o->'order_date',
      'invoice_info', jsonb_build_object(
        'client_name', u.o->'invoice_info'->'client_name',
        'doc_number', CASE WHEN length(regexp_replace(COALESCE(u.o->'invoice_info'->>'doc_number', ''), '\D', '', 'g')) = 14
                           THEN u.o->'invoice_info'->'doc_number' END
      )
    ) END
  FROM unicos u
  LEFT JOIN cupons c ON c.oid = u.oid;
END;
$$;
-- Eventos que entram na lista da equipe: o selecionado e todos os eventos CUPOLA que terminaram antes dele
-- (edições, imersões…), mesmo os que ela não abre no painel. Só nome e data.
CREATE OR REPLACE FUNCTION public.get_buyer_events(p_slug text)
RETURNS TABLE (slug text, name text, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.slug, e.name, e.end_date
  FROM public.events alvo
  JOIN public.events e ON e.end_date <= alvo.end_date
  WHERE alvo.slug = p_slug
    AND auth.uid() IS NOT NULL
    AND (public.has_role(auth.uid(), 'admin') OR (public.is_seller() AND public.can_see_event(alvo.id)))
  ORDER BY e.end_date
$$;
REVOKE ALL ON FUNCTION public.get_buyer_events(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buyer_events(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_buyer_rows(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buyer_rows(text) TO authenticated;

