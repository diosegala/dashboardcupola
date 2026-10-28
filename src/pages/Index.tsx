import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { IntegrationsHealthCard } from "@/components/dashboard/IntegrationsHealthCard";
import { CommercialOverview } from "@/components/dashboard/CommercialOverview";
import { CommercialSegments } from "@/components/dashboard/CommercialSegments";
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
  useAdMetrics,
  useEmailCampaigns,
  useSiteAnalytics,
  useGa4Events,
  useGoals,
  useAllTimeTicketSales,
  useSymplaEventIds,
  findGoal,
  useFormAnswerCounts,
  type DateRange,
} from "@/hooks/useDashboardData";

const ABAS = [
  { value: "comercial", label: "Comercial" },
  { value: "marketing", label: "Marketing" },
] as const;

type Aba = (typeof ABAS)[number]["value"];

function TabSkeleton() {
  return (
    <div className="space-y-4">
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

export default function Index() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  // A aba aberta fica na URL (?aba=marketing) para ser compartilhada e mantida ao recarregar.
  const [searchParams, setSearchParams] = useSearchParams();
  const aba: Aba = searchParams.get("aba") === "marketing" ? "marketing" : "comercial";
  const trocarAba = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "comercial") next.delete("aba");
    else next.set("aba", v);
    setSearchParams(next, { replace: true });
  };
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
  const adMetrics = useAdMetrics(range);
  const emailCampaigns = useEmailCampaigns(range);
  const siteAnalytics = useSiteAnalytics(range);
  const ga4Events = useGa4Events(range);
  const goals = useGoals();
  const allTimeTickets = useAllTimeTicketSales(symplaIds.data?.currentEventId ?? "");
  const formAnswers = useFormAnswerCounts(symplaIds.data?.currentEventId ?? "");

  // Cada aba espera só os dados que usa; cabeçalho e abas aparecem na hora.
  const comercialLoading = symplaIds.isLoading || tickets.isLoading || goals.isLoading || allTimeTickets.isLoading;
  const marketingLoading = tickets.isLoading || goals.isLoading || adMetrics.isLoading || emailCampaigns.isLoading || siteAnalytics.isLoading || ga4Events.isLoading;

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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral de vendas e marketing do CUPOLA Summit"
        actions={
          <>
            <MinPriceFilter value={minTicketPrice} onChange={handleMinPriceChange} />
            <PeriodSelector range={range} onChange={setRange} />
          </>
        }
      />

      <Tabs value={aba} onValueChange={trocarAba}>
        <SlidingTabsList value={aba} className="mb-4">
          {ABAS.map((a) => (
            <TabsTrigger
              key={a.value}
              value={a.value}
              className="relative z-[1] data-[state=active]:bg-transparent data-[state=active]:text-background"
            >
              {a.label}
            </TabsTrigger>
          ))}
        </SlidingTabsList>

        <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
          <TabsContent value="comercial" className="mt-0 animate-panel-in">
            {comercialLoading ? <TabSkeleton /> : (
              <div className="space-y-8">
                <CommercialOverview tickets={allTimeTickets.data ?? []} goals={goals.data ?? []} minTicketPrice={minTicketPrice} />
                <CommercialSegments tickets={allTimeTickets.data ?? []} minTicketPrice={minTicketPrice} formAnswers={formAnswers.data ?? []} />
                <SalesSection
                  tickets={filteredTickets}
                  goals={goals.data ?? []}
                  allTimeTickets={filteredAllTimeTickets}
                  range={range}
                  onEditGoal={isAdmin ? handleEditGoal : undefined}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="marketing" className="mt-0 animate-panel-in space-y-8">
            {marketingLoading ? <TabSkeleton /> : <>
            {isAdmin && <IntegrationsHealthCard />}

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

            <MarketingSection
              adMetrics={adMetrics.data ?? []}
              emailCampaigns={emailCampaigns.data ?? []}
              siteAnalytics={siteAnalytics.data ?? []}
              ga4Events={ga4Events.data ?? []}
              goals={goals.data ?? []}
              range={range}
              onEditGoal={isAdmin ? handleEditGoal : undefined}
            />
            </>}
          </TabsContent>
        </div>
      </Tabs>

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
