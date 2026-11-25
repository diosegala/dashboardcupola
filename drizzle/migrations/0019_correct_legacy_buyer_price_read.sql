CREATE OR REPLACE FUNCTION public.get_buyer_prices(p_event_id text)
RETURNS TABLE(sympla_order_id text, order_id text, ticket_sale_price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $function$
WITH rows AS (
 SELECT d.sympla_order_id, d.participant_data->>'order_id' AS order_id,
 NULLIF(d.participant_data->>'ticket_sale_price','')::numeric AS price,
 NULLIF(d.participant_data->>'ticket_net_value','')::numeric AS net_price,
 NULLIF(d.order_data->>'order_total_sale_price','')::numeric AS gross,
 NULLIF(d.order_data->>'order_total_net_value','')::numeric AS net
 FROM public.ticket_sales_details d
 WHERE public.has_dashboard_access() AND d.participant_data->>'event_id' = p_event_id
), orders AS (
 SELECT r.order_id, count(*) AS qty, sum(price) AS price_sum, min(price) AS lo, max(price) AS hi,
 min(gross) AS gross, min(net) AS net FROM rows r GROUP BY r.order_id
)
SELECT r.sympla_order_id,r.order_id,
 CASE
 WHEN r.net_price IS NOT NULL THEN r.price
 WHEN abs(o.price_sum - o.gross) <= 0.01 THEN r.price
 WHEN o.lo=o.hi AND abs(o.price_sum-o.net)<=0.01 AND o.gross>=o.net AND o.net>0 THEN o.gross / o.qty
 ELSE NULL
 END AS ticket_sale_price
FROM rows r JOIN orders o ON o.order_id=r.order_id
$function$;