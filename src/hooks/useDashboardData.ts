import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, subYears } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getDefaultRange(): DateRange {
  return { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
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
      return data ?? [];
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
  const all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("ticket_sales")
      .select(columns)
      .eq("event_id", eventId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Vendas do evento anterior guardadas na base própria. Vazio enquanto o evento atual for o próprio evento anterior.
export function usePreviousEventTickets(currentEventId: string, previousEventKey: string) {
  return useQuery({
    queryKey: ["previous_event_tickets", previousEventKey, currentEventId],
    enabled: !!currentEventId,
    queryFn: async () => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("event_history" as any)
          .select("data")
          .eq("event_key", previousEventKey)
          .eq("source_table", "ticket_sales")
          .range(from, from + 999);
        if (error) return [];
        all.push(...(data ?? []).map((r: any) => r.data));
        if (!data || data.length < 1000) break;
      }
      if (all.some((t) => t.event_id === currentEventId)) return [];
      return all;
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
      const all: any[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await supabase
          .from("event_history" as any)
          .select("data")
          .eq("event_key", previousEventKey)
          .eq("source_table", sourceTable)
          .gte("record_date", from)
          .lte("record_date", to)
          .range(start, start + 999);
        if (error) return [];
        all.push(...(data ?? []).map((r: any) => r.data));
        if (!data || data.length < 1000) break;
      }
      return all;
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

export function useAllTimeTicketSales(eventId: string) {
  return useQuery({
    queryKey: ["ticket_sales_all_time", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      // Colunas de pagamento e origem só existem depois do SQL novo; sem elas, busca as básicas.
      try {
        return await fetchAllTimeTickets(eventId, `${BASE_TICKET_COLUMNS}, payment_method, utm_source`);
      } catch (err: any) {
        if (err?.code !== "42703") throw err;
        return await fetchAllTimeTickets(eventId, BASE_TICKET_COLUMNS);
      }
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
