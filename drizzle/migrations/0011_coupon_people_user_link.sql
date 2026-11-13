ALTER TABLE public.coupon_people ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;
ALTER TABLE public.coupon_people ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.coupon_people ADD COLUMN IF NOT EXISTS link_manual boolean NOT NULL DEFAULT false;
COMMENT ON TABLE public.team_coupons IS 'DEPRECATED: replaced by coupon_people.user_id';

CREATE OR REPLACE FUNCTION public.coupon_match_key(v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT nullif(btrim(regexp_replace(lower(translate(coalesce(v,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuuccnn')), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.link_coupon_person(p_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid; v_email text; v_name text; v_first text; v_short text; v_count int;
BEGIN
  SELECT id INTO v_id FROM public.coupon_people WHERE user_id = p_user;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = p_user;
  IF v_email IS NULL THEN RETURN NULL; END IF;
  SELECT public.coupon_match_key(p.name) INTO v_name FROM public.profiles p WHERE p.id = p_user;
  v_first := split_part(coalesce(v_name,''), ' ', 1);
  v_short := CASE WHEN position(' ' IN coalesce(v_name,'')) > 0
    THEN v_first || ' ' || left(regexp_replace(v_name, '^.* ', ''), 1) END;

  -- 1) e-mail; 2) nome completo ou nome de quem vende; 3) primeiro nome ou primeiro nome + inicial. Só liga com um único resultado.
  FOR i IN 1..3 LOOP
    SELECT count(*), min(c.id::text)::uuid INTO v_count, v_id FROM public.coupon_people c
    WHERE c.user_id IS NULL AND NOT c.link_manual AND (
      (i = 1 AND lower(btrim(c.email)) = v_email)
      OR (i = 2 AND v_name IS NOT NULL AND (public.coupon_match_key(c.name) = v_name
          OR EXISTS (SELECT 1 FROM unnest(c.seller_names) s WHERE public.coupon_match_key(s) = v_name)))
      OR (i = 3 AND v_first <> '' AND public.coupon_match_key(c.name) IN (v_first, coalesce(v_short, v_first)))
    );
    IF v_count = 1 THEN
      UPDATE public.coupon_people SET user_id = p_user WHERE id = v_id;
      RETURN v_id;
    ELSIF v_count > 1 THEN
      RETURN NULL;
    END IF;
  END LOOP;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.link_coupon_person(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_my_coupon_person()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.link_coupon_person(auth.uid()) WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.link_my_coupon_person() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_coupon_person() TO authenticated;

CREATE OR REPLACE FUNCTION public.coupon_people_autolink()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  FOR r IN SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.coupon_people c WHERE c.user_id = p.id) LOOP
    PERFORM public.link_coupon_person(r.id);
  END LOOP;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS coupon_people_autolink ON public.coupon_people;
CREATE TRIGGER coupon_people_autolink AFTER INSERT OR UPDATE ON public.coupon_people
FOR EACH STATEMENT EXECUTE FUNCTION public.coupon_people_autolink();

CREATE OR REPLACE FUNCTION public.profiles_autolink()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.link_coupon_person(NEW.id);
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS profiles_autolink ON public.profiles;
CREATE TRIGGER profiles_autolink AFTER INSERT OR UPDATE OF name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_autolink();

-- Backfill: quem já tinha cupom digitado em Configurações; depois o cruzamento automático.
UPDATE public.coupon_people c SET user_id = t.user_id, link_manual = true
FROM (SELECT DISTINCT ON (c2.id) c2.id, tc.user_id FROM public.team_coupons tc
      JOIN public.coupon_people c2 ON upper(tc.coupon_code) = ANY (SELECT upper(x) FROM unnest(c2.codes) x)) t
WHERE c.id = t.id AND c.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.coupon_people o WHERE o.user_id = t.user_id);
SELECT public.link_coupon_person(p.id) FROM public.profiles p;