-- Cupom único: o mesmo código nunca pode estar em duas fichas (duas pessoas).
-- Hoje a regra só existe na tela; esta trava garante no banco, inclusive em importações.
-- Pedir no chat do Lovable para rodar os dois passos, nesta ordem.

-- Passo 1 (só leitura): códigos que já estão repetidos. Se vier alguma linha, resolver antes do passo 2.
SELECT upper(trim(c)) AS codigo, array_agg(DISTINCT p.name) AS fichas
FROM public.coupon_people p, unnest(p.codes) AS c
WHERE trim(c) <> ''
GROUP BY upper(trim(c))
HAVING count(DISTINCT p.id) > 1;

-- Passo 2: recusa gravar uma ficha com código que já pertence a outra ficha.
CREATE OR REPLACE FUNCTION public.coupon_code_unico()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  repetido text;
BEGIN
  SELECT upper(trim(c)) INTO repetido
  FROM unnest(NEW.codes) AS c
  WHERE trim(c) <> ''
    AND EXISTS (
      SELECT 1 FROM public.coupon_people o, unnest(o.codes) AS oc
      WHERE o.id <> NEW.id AND upper(trim(oc)) = upper(trim(c))
    )
  LIMIT 1;
  IF repetido IS NOT NULL THEN
    RAISE EXCEPTION 'O cupom % já pertence a outra pessoa', repetido USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coupon_code_unico ON public.coupon_people;
CREATE TRIGGER coupon_code_unico
BEFORE INSERT OR UPDATE OF codes ON public.coupon_people
FOR EACH ROW EXECUTE FUNCTION public.coupon_code_unico();
