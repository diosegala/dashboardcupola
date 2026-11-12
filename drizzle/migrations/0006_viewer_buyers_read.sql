DO $$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.get_buyer_rows(text)','public.get_buyer_events(text)','public.contact_search_keys(text)'] LOOP
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d, 'public.is_seller()', '(public.is_seller() OR public.has_role(auth.uid(), ''viewer''))');
    EXECUTE d;
  END LOOP;
END $$;