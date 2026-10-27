import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { MinPriceFilter } from "@/components/dashboard/MinPriceFilter";
import { SalesSection } from "@/components/dashboard/SalesSection";
import { MarketingSection } from "@/components/dashboard/MarketingSection";
import { FunnelKPISection } from "@/components/dashboard/FunnelKPISection";
import { GoalFormDialog, type GoalFormValues } from "@/components/goals/GoalFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMetricLabel } from "@/lib/goalMetrics";
import {
  getDefaultRange,
  useTicketSales,
  useDeals,
  useAdMetrics,
  useEmailCampaigns,
  useSiteAnalytics,
  useGa4Events,
  useGoals,
  useAllTimeTicketSales,
  useSymplaEventIds,
  findGoal,
  type DateRange,
} from "@/hooks/useDashboardData";

export default function Index() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>(getDefaultRange);
  const [minTicketPrice, setMinTicketPrice] = useState<number>(() => {
    const stored = localStorage.getItem("dashboard_min_ticket_price");
    return stored ? parseFloat(stored) : 0;
  });

  const handleMinPriceChange = useCallback((v: number) => {
    setMinTicketPrice(v);
    localStorage.setItem("dashboard_min_ticket_price", String(v));
  }, []);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [goalFormDefaults, setGoalFormDefaults] = useState<Partial<GoalFormValues> | undefined>();

  const symplaIds = useSymplaEventIds();
  const tickets = useTicketSales(range);
  const deals = useDeals(range);
  const adMetrics = useAdMetrics(range);
  const emailCampaigns = useEmailCampaigns(range);
  const siteAnalytics = useSiteAnalytics(range);
  const ga4Events = useGa4Events(range);
  const goals = useGoals();
  const allTimeTickets = useAllTimeTicketSales(symplaIds.data?.currentEventId ?? "");

  const isLoading = symplaIds.isLoading || tickets.isLoading || deals.isLoading || adMetrics.isLoading || emailCampaigns.isLoading || siteAnalytics.isLoading || ga4Events.isLoading || goals.isLoading || allTimeTickets.isLoading;

  const filterTickets = useCallback((data: any[]) => {
    if (minTicketPrice <= 0) return data;
    return data.filter((t) => Number(t.unit_price ?? t.total_price ?? 0) >= minTicketPrice);
  }, [minTicketPrice]);

  const filteredTickets = useMemo(() => filterTickets(tickets.data ?? []), [tickets.data, filterTickets]);
  const filteredAllTimeTickets = useMemo(() => filterTickets(allTimeTickets.data ?? []), [allTimeTickets.data, filterTickets]);

  const upsertMutation = useMutation({
    mutationFn: async (values: GoalFormValues & { id?: string }) => {
      const base = {
        label: values.label,
        metric_key: values.metric_key,
        target_value: values.target_value,
        period_start: format(values.period_start, "yyyy-MM-dd"),
        period_end: format(values.period_end, "yyyy-MM-dd"),
        ticket_type: values.ticket_type ?? null,
      } as any;

      if (values.id) {
        const { error } = await supabase.from("goals").update(base).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert([{ ...base, created_by: user!.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setGoalFormOpen(false);
      toast.success("Meta salva com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar meta: " + err.message);
    },
  });

  const handleEditGoal = (metricKey: string, ticketType?: string | null) => {
    // Check if a goal already exists for this metric + range
    const existingGoal = findGoal(goals.data ?? [], metricKey, range, ticketType);

    setGoalFormDefaults({
      label: existingGoal?.label ?? getMetricLabel(metricKey),
      metric_key: metricKey,
      target_value: existingGoal ? Number(existingGoal.target_value) : 0,
      period_start: range.from,
      period_end: range.to,
      ticket_type: ticketType ?? null,
    });
    setGoalFormOpen(true);
  };

  const handleGoalSubmit = (values: GoalFormValues) => {
    // Find existing goal to update instead of creating duplicate
    const existingGoal = findGoal(goals.data ?? [], values.metric_key, {
      from: values.period_start,
      to: values.period_end,
    }, values.ticket_type);

    upsertMutation.mutate({ ...values, id: existingGoal?.id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral de vendas e marketing — Cupola Summit</p>
        </div>
        <div className="flex items-center gap-2">
          <MinPriceFilter value={minTicketPrice} onChange={handleMinPriceChange} />
          <PeriodSelector range={range} onChange={setRange} />
        </div>
      </div>

      <FunnelKPISection
        adMetrics={adMetrics.data ?? []}
        emailCampaigns={emailCampaigns.data ?? []}
        tickets={filteredTickets}
        goals={goals.data ?? []}
        range={range}
        onEditGoal={!isAdmin ? undefined : (metricKey, periodStart, periodEnd) => {
          const existingGoal = findGoal(goals.data ?? [], metricKey, { from: periodStart, to: periodEnd });
          setGoalFormDefaults({
            label: existingGoal?.label ?? getMetricLabel(metricKey),
            metric_key: metricKey,
            target_value: existingGoal ? Number(existingGoal.target_value) : 0,
            period_start: periodStart,
            period_end: periodEnd,
          });
          setGoalFormOpen(true);
        }}
      />

      <SalesSection
        tickets={filteredTickets}
        goals={goals.data ?? []}
        allTimeTickets={filteredAllTimeTickets}
        range={range}
        onEditGoal={isAdmin ? handleEditGoal : undefined}
      />

      <Separator />

      <MarketingSection
        adMetrics={adMetrics.data ?? []}
        emailCampaigns={emailCampaigns.data ?? []}
        siteAnalytics={siteAnalytics.data ?? []}
        ga4Events={ga4Events.data ?? []}
        goals={goals.data ?? []}
        range={range}
        onEditGoal={isAdmin ? handleEditGoal : undefined}
      />

      <GoalFormDialog
        open={goalFormOpen}
        onOpenChange={setGoalFormOpen}
        onSubmit={handleGoalSubmit}
        defaultValues={goalFormDefaults}
        isSubmitting={upsertMutation.isPending}
      />
    </div>
  );
}
