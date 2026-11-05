ALTER POLICY "Sellers cannot read deals"
ON public.deals
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
  OR (status = 'won' AND is_deleted = false)
);

ALTER POLICY "Sellers cannot read deal_products"
ON public.deal_products
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
  OR EXISTS (
    SELECT 1
    FROM public.deals AS d
    WHERE d.id = deal_products.deal_id
      AND d.status = 'won'
      AND d.is_deleted = false
  )
);

ALTER POLICY "Sellers cannot read crm_products"
ON public.crm_products
USING (true);

ALTER POLICY "Sellers cannot read deal_installments"
ON public.deal_installments
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);

ALTER POLICY "Sellers cannot read crm_leads"
ON public.crm_leads
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);

ALTER POLICY "Sellers cannot read crm_organizations"
ON public.crm_organizations
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR NOT public.is_seller()
);