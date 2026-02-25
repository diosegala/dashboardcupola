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

export function findGoal(goals: any[], metricKey: string, currentDate: Date = new Date()) {
  const today = fmt(currentDate);
  const matching = goals
    .filter((g: any) => g.metric_key === metricKey && g.period_start <= today && g.period_end >= today)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return matching[0] ?? null;
}
