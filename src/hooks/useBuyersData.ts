import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent, type EventRow } from "@/hooks/useEvent";
import { buildBuyers, eventRef, type DetailRow } from "@/lib/buyers";
import { fetchAllPages } from "@/lib/fetchPages";

// Lê uma consulta em páginas de 1000 linhas.
// Várias páginas ao mesmo tempo (fetchAllPages).
function paginado(consulta: (from: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  return fetchAllPages((from) => consulta(from));
}

// Cupom de cada ingresso do evento: das vendas atuais e das guardadas na base própria.
async function loadCoupons(e: EventRow): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const historicoP = paginado((from) =>
    supabase
      .from("event_history" as any)
      .select("sid:data->>sympla_order_id, cupom:data->>coupon_code")
      .eq("event_key", e.slug)
      .eq("source_table", "ticket_sales")
      .not("data->>coupon_code", "is", null)
      .range(from, from + 999),
  );
  const vendasP = e.sympla_event_id
    ? paginado((from) =>
      supabase
        .from("ticket_sales")
        .select("sympla_order_id, coupon_code")
        .eq("event_id", e.sympla_event_id!)
        .not("coupon_code", "is", null)
        .range(from, from + 999),
    )
    : Promise.resolve([]);
  const [historico, vendas] = await Promise.all([historicoP, vendasP]);
  historico.forEach((r) => r.sid && r.cupom && map.set(String(r.sid), r.cupom));
  vendas.forEach((r) => map.set(String(r.sympla_order_id), r.coupon_code));
  return map;
}

// Dados completos de um evento: os da Sympla e os guardados na base própria, sem repetir pedidos, com o cupom.
async function loadEventRows(e: EventRow): Promise<DetailRow[]> {
  const map = new Map<string, DetailRow>();
  const cuponsP = loadCoupons(e);
  const historicoP = paginado((from) =>
    supabase
      .from("event_history" as any)
      .select("data")
      .eq("event_key", e.slug)
      .eq("source_table", "ticket_sales_details")
      .range(from, from + 999),
  );
  const id = e.sympla_event_id;
  const atuaisP = id
    ? paginado((from) =>
      supabase
        .from("ticket_sales_details" as any)
        .select("sympla_order_id, participant_data, order_data")
        .or(`participant_data->>event_id.eq.${id},order_data->>event_id.eq.${id}`)
        .range(from, from + 999),
    )
    : Promise.resolve([]);
  const [historico, atuais, cupons] = await Promise.all([historicoP, atuaisP, cuponsP]);
  historico.forEach((r) => map.set(r.data.sympla_order_id, r.data));
  atuais.forEach((r) => map.set(r.sympla_order_id, r));
  return Array.from(map.values()).map((r) => ({ ...r, coupon: cupons.get(String(r.sympla_order_id)) ?? null }));
}

// Pessoas e empresas da tela Compradores (só administradores), com o evento selecionado e os anteriores.
// Usado também pelo detalhe do comprador na aba de e-mails, com a mesma consulta e as mesmas permissões.
export function useBuyersData() {
  const { canViewAll: isAdmin } = useAuth();
  const { events, event } = useEvent();
  // Referência é o evento selecionado: entram ele e os eventos anteriores (para saber quem já veio antes).
  const relevantes = useMemo(() => events.filter((e) => e.slug === event.slug || e.end_date < event.end_date), [events, event]);
  const dados = useQuery({
    queryKey: ["buyers", event.slug, relevantes.map((e) => `${e.slug}:${e.sympla_event_id}`).join("|")],
    enabled: isAdmin && relevantes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => Promise.all(relevantes.map(async (e) => ({ event: eventRef(e), rows: await loadEventRows(e) }))),
  });
  const { people, companies } = useMemo(() => buildBuyers(dados.data ?? []), [dados.data]);
  const eventos = useMemo(() => (dados.data ?? []).map((d) => d.event).sort((a, b) => a.endDate.localeCompare(b.endDate)), [dados.data]);
  return { dados, people, companies, eventos };
}
