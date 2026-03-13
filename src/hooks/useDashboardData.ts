import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";

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

export function useAllTimeTicketSales(eventId: string) {
  return useQuery({
    queryKey: ["ticket_sales_all_time", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("ticket_sales")
          .select("quantity, total_price, sold_at")
          .eq("event_id", eventId)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });
}

export function useSymplaEventIds() {
  return useQuery({
    queryKey: ["sympla_event_ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("credentials")
        .eq("name", "sympla")
        .single();
      if (error) throw error;
      const creds = (data?.credentials as Record<string, string>) ?? {};
      return {
        currentEventId: creds.event_id || "",
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

export function findGoal(goals: any[], metricKey: string, range: DateRange) {
  const rangeFrom = fmt(range.from);
  const rangeTo = fmt(range.to);

  const overlapping = goals.filter(
    (g: any) => g.metric_key === metricKey && g.period_start <= rangeTo && g.period_end >= rangeFrom
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
