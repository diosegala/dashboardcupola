DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n text;
BEGIN
  n := nullif(btrim(NEW.raw_user_meta_data->>'name'), '');
  IF n IS NULL THEN
    n := initcap(regexp_replace(split_part(NEW.email, '@', 1), '[._-]+', ' ', 'g'));
  ELSE
    n := initcap(lower(regexp_replace(n, '\s+', ' ', 'g')));
  END IF;
  INSERT INTO public.profiles (id, name) VALUES (NEW.id, n);
  RETURN NEW;
END;
$function$;

UPDATE public.profiles SET name = initcap(regexp_replace(split_part(name, '@', 1), '[._-]+', ' ', 'g')) WHERE name LIKE '%@%';