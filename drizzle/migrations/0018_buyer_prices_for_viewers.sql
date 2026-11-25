CREATE OR REPLACE FUNCTION public.get_buyer_prices(p_event_id text)
RETURNS TABLE(sympla_order_id text, order_id text, ticket_sale_price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.sympla_order_id, d.participant_data->>'order_id',
         NULLIF(d.participant_data->>'ticket_sale_price','')::numeric
  FROM public.ticket_sales_details d
  WHERE public.has_dashboard_access()
    AND d.participant_data->>'event_id' = p_event_id
$$;
REVOKE ALL ON FUNCTION public.get_buyer_prices(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_buyer_prices(text) TO authenticated;