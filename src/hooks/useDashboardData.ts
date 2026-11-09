import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, subYears } from "date-fns";
import { withSaleDate } from "@/lib/period";
import { invoicedToTickets, isTicketProduct, parseDealTitle, redeemedDeal } from "@/lib/invoicedTickets";
import { cupomDePatrocinador } from "@/lib/salesChannel";
import { withBatchByDate } from "@/lib/batches";
import { batchCalendar } from "@/lib/batchCalendar";
import { batchCalendarVersion } from "@/hooks/useEventBatches";
import { fetchAllPages } from "@/lib/fetchPages";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getDefaultRange(): DateRange {
  return { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
}

// "Todo o período": de 2020 até hoje. Padrão da página Comercial, que mostra o evento inteiro até alguém filtrar.
export function getWholeRange(): DateRange {
  return { from: new Date(2020, 0, 1), to: new Date() };
}

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function useTicketSales(range: DateRange) {
  return useQuery({
    queryKey: ["ticket_sales", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("*")
        .gte("sold_at", range.from.toISOString())
        .lte("sold_at", range.to.toISOString());
      if (error) throw error;
      return withSaleDate(data ?? []);
    },
  });
}

export function useDeals(range: DateRange) {
  return useQuery({
    queryKey: ["deals", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .gte("created_at_source", range.from.toISOString())
        .lte("created_at_source", range.to.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdMetrics(range: DateRange) {
  return useQuery({
    queryKey: ["ad_metrics", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_metrics")
        .select("*")
        .gte("date", fmt(range.from))
        .lte("date", fmt(range.to));
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmailCampaigns(range: DateRange) {
  return useQuery({
    queryKey: ["email_campaigns", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .gte("sent_at", range.from.toISOString())
        .lte("sent_at", range.to.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSiteAnalytics(range: DateRange) {
  return useQuery({
    queryKey: ["site_analytics", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_analytics")
        .select("*")
        .gte("date", fmt(range.from))
        .lte("date", fmt(range.to))
        .order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

const BASE_TICKET_COLUMNS = "quantity, total_price, unit_price, sold_at, status, ticket_type, coupon_code, buyer_state, company_size";

async function fetchAllTimeTickets(eventId: string, columns: string) {
  // Páginas lidas várias ao mesmo tempo (fetchAllPages).
  const all = await fetchAllPages((from, to) =>
    supabase
      .from("ticket_sales")
      .select(columns)
      .eq("event_id", eventId)
      // Linhas de estimativa de versões antigas da sincronização: não contam (só participantes reais).
      .not("sympla_order_id", "like", "pendente-%")
      // Ordem fixa: sem ela, a paginação pode repetir ou pular linhas quando a sincronização grava no meio da leitura.
      .order("id")
      .range(from, to) as any,
  { throwOnError: true });
  return withSaleDate(all);
}

// Vendas do evento anterior guardadas na base própria. Vazio enquanto o evento atual for o próprio evento anterior.
export function usePreviousEventTickets(currentEventId: string, previousEventKey: string) {
  return useQuery({
    queryKey: ["previous_event_tickets", previousEventKey, currentEventId],
    enabled: !!currentEventId,
    queryFn: async () => {
      let all: any[];
      try {
        const rows = await fetchAllPages((from, to) =>
          supabase.from("event_history" as any).select("data").eq("event_key", previousEventKey).eq("source_table", "ticket_sales").order("id").range(from, to) as any,
        { throwOnError: true });
        all = rows.map((r: any) => r.data);
      } catch {
        return [];
      }
      if (all.some((t) => t.event_id === currentEventId)) return [];
      return withSaleDate(all);
    },
  });
}

// Linhas de uma tabela do evento anterior (base própria) no mesmo período do ano anterior.
export function usePreviousEventRows(previousEventKey: string, sourceTable: string, range: DateRange) {
  const from = fmt(subYears(range.from, 1));
  const to = fmt(subYears(range.to, 1));
  return useQuery({
    queryKey: ["previous_event_rows", previousEventKey, sourceTable, from, to],
    enabled: !!previousEventKey,
    queryFn: async () => {
      try {
        const rows = await fetchAllPages((start, end) =>
          supabase.from("event_history" as any).select("data").eq("event_key", previousEventKey).eq("source_table", sourceTable)
            .gte("record_date", from).lte("record_date", to).order("id").range(start, end) as any,
        { throwOnError: true });
        return rows.map((r: any) => r.data);
      } catch {
        return [];
      }
    },
  });
}

// Respostas do formulário de inscrição agregadas por pergunta (sem dados pessoais). Vazio até o SQL novo existir.
export function useFormAnswerCounts(eventId: string) {
  return useQuery({
    queryKey: ["form_answer_counts", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_form_answer_counts", { p_event_id: eventId });
      if (error) return [] as { question: string; answer: string; total: number }[];
      return (data ?? []) as { question: string; answer: string; total: number }[];
    },
  });
}

// Faturados internamente do evento: negócios do Pipedrive com ingresso do Summit (produto "Ingressos Summit" ou, sem
// produto, título "[SUM] ... | N ingressos"), entre o fim do evento anterior e o fim deste (o produto é o mesmo todo ano).
// Ganhos contam como venda; abertos ficam "em negociação". Quem não pode ler o CRM recebe lista vazia.
const DEAL_COLUMNS = "id, pipedrive_deal_id, title, status, stage_name, org_name, value, won_at, created_at_source, custom_fields, pipeline_pd_id";
type InvoicedRaw = { deals: any[]; linhas: any[]; account: string | null } | null;
// Só a leitura do CRM: roda junto com a leitura das vendas da Sympla, sem esperar por ela.
async function fetchInvoicedRaw(symplaEventId: string): Promise<InvoicedRaw> {
  const { data: ev } = await supabase.from("events").select("id, end_date").eq("sympla_event_id", symplaEventId).maybeSingle();
  if (!ev) return null;
  const [{ data: cfg }, { data: antes }] = await Promise.all([
    supabase.from("sponsorship_config").select("crm_account, pipelines").eq("event_id", ev.id).maybeSingle(),
    supabase.from("events").select("end_date").lt("end_date", ev.end_date).order("end_date", { ascending: false }).limit(1),
  ]);
  // Quem não lê a configuração (equipe de vendas) busca os ingressos ganhos sem filtrar a conta: o banco já só
  // entrega negócios ganhos para a equipe. Sem conta configurada para o administrador, não há faturados.
  const account = cfg?.crm_account?.trim() ?? null;
  if (cfg && !account) return null;
  const daConta = <Q,>(q: Q): Q => (account ? (q as any).eq("crm_account", account) : q);
  const funis = ((cfg?.pipelines as any[]) ?? []).filter((p) => p.represents === "ingressos").map((p) => Number(p.pipeline_pd_id));
  const inicio = `${antes?.[0]?.end_date ?? "1900-01-01"}T23:59:59`;
  const fim = `${ev.end_date}T23:59:59`;
  const doEvento = (d: any) => {
    const quando = d.status === "won" ? d.won_at : d.created_at_source;
    return !!quando && quando > inicio && quando <= fim;
  };

  // Negócios do funil de ingressos sem produto cadastrado (entram pelo título): lidos junto com os produtos.
  const porTitulo = funis.length && account
    ? fetchAllPages((from, to) =>
        supabase.from("deals").select(DEAL_COLUMNS).eq("crm_account", account).in("pipeline_pd_id", funis)
          .in("status", ["won", "open"]).eq("is_deleted", false).ilike("title", "%ingress%").order("id").range(from, to) as any)
    : Promise.resolve([] as any[]);
  const { data: produtos } = await daConta(supabase.from("crm_products").select("pd_id, name").eq("kind", "product"));
  const ids = (produtos ?? []).filter((p) => isTicketProduct(p.name)).map((p) => p.pd_id);
  let linhas: any[] = [];
  try {
    linhas = ids.length
      ? await fetchAllPages((from, to) =>
          daConta(supabase.from("deal_products").select("deal_id, name, quantity, item_price, sum, discount, discount_type"))
            .eq("is_enabled", true).in("product_pd_id", ids).order("id").range(from, to) as any,
        { throwOnError: true })
      : [];
  } catch {
    return null;
  }
  const negocios = new Map<string, any>();
  const dealIds = [...new Set(linhas.map((l) => l.deal_id))];
  const grupos: string[][] = [];
  for (let i = 0; i < dealIds.length; i += 200) grupos.push(dealIds.slice(i, i + 200));
  const respostas = await Promise.all(
    grupos.map((g) => supabase.from("deals").select(DEAL_COLUMNS).in("id", g).in("status", ["won", "open"]).eq("is_deleted", false)),
  );
  if (respostas.some((r) => r.error)) return null;
  respostas.forEach((r) => (r.data ?? []).forEach((d) => negocios.set(d.id, d)));
  (await porTitulo).forEach((d: any) => negocios.has(d.id) || negocios.set(d.id, d));
  return { deals: [...negocios.values()].filter(doEvento), linhas, account };
}

// Empresas que já fecharam patrocínio: os nomes delas costumam virar cupom. Quem não lê o CRM recebe lista vazia.
async function fetchSponsorCompanies(symplaEventId: string): Promise<string[]> {
  const { data: ev } = await supabase.from("events").select("id").eq("sympla_event_id", symplaEventId).maybeSingle();
  if (!ev) return [];
  const { data: cfg } = await supabase.from("sponsorship_config").select("crm_account, pipelines").eq("event_id", ev.id).maybeSingle();
  const account = cfg?.crm_account?.trim();
  const funis = ((cfg?.pipelines as any[]) ?? []).filter((p) => p.represents !== "ingressos").map((p) => Number(p.pipeline_pd_id));
  if (!account || !funis.length) return [];
  const ganhos = await fetchAllPages((from, to) =>
    supabase.from("deals").select("id, org_name, title").eq("crm_account", account).in("pipeline_pd_id", funis)
      .eq("status", "won").eq("is_deleted", false).order("id").range(from, to) as any);
  return [...new Set((ganhos as any[]).map((d) => d.org_name || parseDealTitle(d.title).empresa).filter(Boolean))] as string[];
}

function invoicedFromRaw(raw: InvoicedRaw, symplaSales: any[]) {
  if (!raw) return [];
  // Conta do Pipedrive em cada ingresso, para o painel abrir o negócio no CRM.
  return invoicedToTickets(raw.deals, raw.linhas, symplaSales).map((t) => ({ ...t, crm_account: raw.account }));
}

// Todas as vendas do evento: Sympla + faturados internamente (Pipedrive), no mesmo formato.
export function useAllTimeTicketSales(eventId: string) {
  return useQuery({
    queryKey: ["ticket_sales_all_time", eventId, batchCalendarVersion()],
    enabled: !!eventId,
    queryFn: async () => {
      // CRM e Sympla são lidos ao mesmo tempo.
      const crm = fetchInvoicedRaw(eventId).catch(() => null);
      const patrocinadores = fetchSponsorCompanies(eventId).catch(() => [] as string[]);
      // Colunas de pagamento e origem só existem depois do SQL novo; sem elas, busca as básicas.
      let sympla: any[];
      try {
        sympla = await fetchAllTimeTickets(eventId, `${BASE_TICKET_COLUMNS}, payment_method, utm_source, utm_medium, utm_campaign, utm_content, sympla_order_id, order_id, buyer_name`);
      } catch (err: any) {
        if (err?.code !== "42703") throw err;
        sympla = await fetchAllTimeTickets(eventId, BASE_TICKET_COLUMNS);
      }
      const faturados = invoicedFromRaw(await crm, sympla);
      // Resgate na Sympla de um faturado ganho (cupom com o nome da empresa): vira baixa, não cortesia nem venda.
      const empresas = faturados.filter((f) => f.status === "approved").map((f) => ({ deal_id: f.deal_id, company: f.company }));
      const nomesPatrocinadores = await patrocinadores;
      const comResgate = sympla.map((t) => {
        const deal = redeemedDeal(t.coupon_code, empresas);
        const sponsor_coupon = cupomDePatrocinador(t.coupon_code, nomesPatrocinadores);
        return deal || sponsor_coupon ? { ...t, ...(deal ? { redeems: deal } : {}), sponsor_coupon } : t;
      });
      // Lote pela data: vale o lote vigente no dia da venda (muda na primeira venda do lote seguinte).
      return withBatchByDate([...comResgate, ...faturados], batchCalendar(eventId));
    },
  });
}

export function useSymplaEventIds() {
  return useQuery({
    queryKey: ["sympla_event_ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_sympla_event_id");
      if (error) throw error;
      return {
        currentEventId: (data as string | null) || "",
      };
    },
  });
}

export function useGa4Events(range: DateRange) {
  return useQuery({
    queryKey: ["ga4_events", fmt(range.from), fmt(range.to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ga4_events")
        .select("*")
        .gte("date", fmt(range.from))
        .lte("date", fmt(range.to));
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function findGoal(goals: any[], metricKey: string, range: DateRange, ticketType?: string | null) {
  const rangeFrom = fmt(range.from);
  const rangeTo = fmt(range.to);

  const overlapping = goals.filter(
    (g: any) => {
      if (g.metric_key !== metricKey) return false;
      if (g.period_start > rangeTo || g.period_end < rangeFrom) return false;
      // ticket_type filtering: if ticketType is explicitly provided, match it
      const goalTicketType = g.ticket_type ?? null;
      const searchTicketType = ticketType === undefined ? null : ticketType;
      if (goalTicketType !== searchTicketType) return false;
      return true;
    }
  );

  if (overlapping.length === 0) return null;

  const scored = overlapping.map((g: any) => {
    const gStart = new Date(g.period_start).getTime();
    const gEnd = new Date(g.period_end).getTime();
    const rStart = range.from.getTime();
    const rEnd = range.to.getTime();
    const overlapStart = Math.max(gStart, rStart);
    const overlapEnd = Math.min(gEnd, rEnd);
    const overlapDays = Math.max(0, overlapEnd - overlapStart);
    const goalDays = gEnd - gStart || 1;
    const rangeDays = rEnd - rStart || 1;
    const score = overlapDays / Math.max(goalDays, rangeDays);
    return { goal: g, score };
  });

  scored.sort(
    (a, b) => b.score - a.score || new Date(b.goal.created_at).getTime() - new Date(a.goal.created_at).getTime()
  );

  return scored[0]?.goal ?? null;
}
