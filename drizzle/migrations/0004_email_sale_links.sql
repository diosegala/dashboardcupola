ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS utm_content text;
UPDATE public.ticket_sales s SET utm_content = nullif(btrim(d.order_data->'utm'->>'utm_content'), '')
FROM public.ticket_sales_details d
WHERE d.sympla_order_id = s.sympla_order_id AND s.utm_content IS NULL AND (d.order_data->'utm'->>'utm_content') IS NOT NULL;

CREATE TABLE public.email_sale_links (
  utm_content text PRIMARY KEY,
  rd_campaign_id text,
  decision text NOT NULL DEFAULT 'confirmed',
  decided_by uuid,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_sale_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.email_sale_links TO authenticated;
GRANT ALL ON public.email_sale_links TO service_role;
ALTER TABLE public.email_sale_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem ligações" ON public.email_sale_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gravam ligações" ON public.email_sale_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));