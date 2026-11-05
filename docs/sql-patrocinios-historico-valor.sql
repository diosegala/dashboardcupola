-- Patrocínios: histórico do valor dos produtos nos negócios (05/11/2026).
-- Rodar inteiro no editor SQL do Lovable. Não apaga dados.
--
-- O Pipedrive só entrega o valor de agora. A partir deste SQL, toda vez que a sincronização grava um produto de
-- negócio com valor, quantidade ou situação diferente, o banco guarda uma linha com o novo valor e a data.
-- A página usa isso para mostrar a evolução do valor em negociação. A data é a da sincronização que percebeu a
-- mudança (até 15 minutos depois da mudança no Pipedrive). O histórico começa hoje, com o valor atual de cada produto.

CREATE TABLE IF NOT EXISTS public.deal_product_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_account text NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  deal_product_pd_id bigint NOT NULL,
  product_pd_id bigint,
  quantity numeric NOT NULL DEFAULT 1,
  sum numeric NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_product_value_history_deal_idx ON public.deal_product_value_history (crm_account, deal_id, changed_at);

ALTER TABLE public.deal_product_value_history ENABLE ROW LEVEL SECURITY;
-- Leitura igual à dos produtos dos negócios: quem vê a conta vê o histórico; a equipe de vendas não vê.
DROP POLICY IF EXISTS "View value history of allowed accounts" ON public.deal_product_value_history;
CREATE POLICY "View value history of allowed accounts" ON public.deal_product_value_history
  FOR SELECT TO authenticated USING (public.can_see_crm_account(crm_account));
DROP POLICY IF EXISTS "Sellers cannot read value history" ON public.deal_product_value_history;
CREATE POLICY "Sellers cannot read value history" ON public.deal_product_value_history
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_seller());
-- Ninguém grava pela tela: só a regra abaixo.

CREATE OR REPLACE FUNCTION public.deal_products_guarda_valor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.sum IS DISTINCT FROM OLD.sum
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.is_enabled IS DISTINCT FROM OLD.is_enabled THEN
    INSERT INTO public.deal_product_value_history (crm_account, deal_id, deal_product_pd_id, product_pd_id, quantity, sum, is_enabled)
    VALUES (NEW.crm_account, NEW.deal_id, NEW.pd_id, NEW.product_pd_id, coalesce(NEW.quantity, 1), coalesce(NEW.sum, 0), coalesce(NEW.is_enabled, true));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_products_guarda_valor ON public.deal_products;
CREATE TRIGGER deal_products_guarda_valor
AFTER INSERT OR UPDATE ON public.deal_products
FOR EACH ROW EXECUTE FUNCTION public.deal_products_guarda_valor();

-- Produto removido do negócio no Pipedrive: guarda o valor zerado.
CREATE OR REPLACE FUNCTION public.deal_products_guarda_remocao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deal_product_value_history (crm_account, deal_id, deal_product_pd_id, product_pd_id, quantity, sum, is_enabled)
  VALUES (OLD.crm_account, OLD.deal_id, OLD.pd_id, OLD.product_pd_id, 0, 0, false);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS deal_products_guarda_remocao ON public.deal_products;
CREATE TRIGGER deal_products_guarda_remocao
AFTER DELETE ON public.deal_products
FOR EACH ROW EXECUTE FUNCTION public.deal_products_guarda_remocao();

-- Ponto de partida: o valor de hoje de cada produto (só uma vez; rodar de novo não duplica).
INSERT INTO public.deal_product_value_history (crm_account, deal_id, deal_product_pd_id, product_pd_id, quantity, sum, is_enabled, changed_at)
SELECT dp.crm_account, dp.deal_id, dp.pd_id, dp.product_pd_id, coalesce(dp.quantity, 1), coalesce(dp.sum, 0), coalesce(dp.is_enabled, true), now()
FROM public.deal_products dp
WHERE NOT EXISTS (SELECT 1 FROM public.deal_product_value_history h WHERE h.deal_id = dp.deal_id AND h.deal_product_pd_id = dp.pd_id);

-- Conferência: quantos produtos já têm o ponto de partida.
SELECT count(*) AS registros, count(DISTINCT deal_id) AS negocios FROM public.deal_product_value_history;
