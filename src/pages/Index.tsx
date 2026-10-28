import { PageHeader } from "@/components/PageHeader";
import { Chip } from "@/components/Chip";
import { goalsOfEvent, isEventClosed, useEvent } from "@/hooks/useEvent";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { IntegrationsHealthCard } from "@/components/dashboard/IntegrationsHealthCard";
import { CommercialOverview } from "@/components/dashboard/CommercialOverview";
import { CommercialSegments } from "@/components/dashboard/CommercialSegments";
import { SellerHome } from "@/components/dashboard/SellerHome";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { SalesSection } from "@/components/dashboard/SalesSection";
import { MarketingSection } from "@/components/dashboard/MarketingSection";
import { FunnelKPISection } from "@/components/dashboard/FunnelKPISection";
import { useAuth } from "@/hooks/useAuth";
import {
  getDefaultRange,
  useTicketSales,
  useAdMetrics,
  useEmailCampaigns,
  useSiteAnalytics,
  useGa4Events,
  useGoals,
  useAllTimeTicketSales,
  usePreviousEventTickets,
  usePreviousEventRows,
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

// A equipe de vendas vê só o próprio ranking; os demais veem o painel completo.
export default function Index() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerHome /> : <Dashboard />;
}

function Dashboard() {
  const { isAdmin } = useAuth();
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

  const { event, isLoading: eventLoading } = useEvent();
  const currentEventId = event.sympla_event_id ?? "";
  const tickets = useTicketSales(range);
  const adMetrics = useAdMetrics(range);
  const emailCampaigns = useEmailCampaigns(range);
  const siteAnalytics = useSiteAnalytics(range);
  const ga4Events = useGa4Events(range);
  const goals = useGoals();
  const allTimeTickets = useAllTimeTicketSales(currentEventId);
  const previousTickets = usePreviousEventTickets(currentEventId, event.previous_event_slug ?? "");
  const previousAdMetrics = usePreviousEventRows(event.previous_event_slug ?? "", "ad_metrics", range);
  const previousSiteAnalytics = usePreviousEventRows(event.previous_event_slug ?? "", "site_analytics", range);
  // Depois do último dia o evento fica "Encerrado"; as integrações continuam atualizando se trouxerem dados.
  const encerrado = isEventClosed(event);
  const eventGoals = goalsOfEvent(goals.data ?? [], event);
  const eventParams = {
    eventDate: new Date(`${event.start_date ?? event.end_date}T00:00:00`),
  };

  // Cada aba espera só os dados que usa; cabeçalho e abas aparecem na hora.
  const comercialLoading = eventLoading || tickets.isLoading || goals.isLoading || allTimeTickets.isLoading;
  const marketingLoading = tickets.isLoading || goals.isLoading || adMetrics.isLoading || emailCampaigns.isLoading || siteAnalytics.isLoading || ga4Events.isLoading;

  return (
    <div>
      <PageHeader
        kicker={event.name}
        title="Dashboard"
        badge={encerrado ? <Chip variant="neutral">Encerrado</Chip> : undefined}
        description="Visão geral de vendas e marketing do CUPOLA Summit"
        actions={
          <PeriodSelector range={range} onChange={setRange} />
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
                <CommercialOverview tickets={allTimeTickets.data ?? []} goals={eventGoals} previousTickets={previousTickets.data ?? []} eventParams={eventParams} />
                <CommercialSegments tickets={allTimeTickets.data ?? []} goals={eventGoals} />
                <SalesSection
                  tickets={tickets.data ?? []}
                  goals={eventGoals}
                  allTimeTickets={allTimeTickets.data ?? []}
                  previousYearTickets={previousTickets.data ?? []}
                  range={range}
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
              tickets={tickets.data ?? []}
              goals={eventGoals}
              range={range}
            />

            <MarketingSection
              adMetrics={adMetrics.data ?? []}
              emailCampaigns={emailCampaigns.data ?? []}
              siteAnalytics={siteAnalytics.data ?? []}
              ga4Events={ga4Events.data ?? []}
              previousAdMetrics={previousAdMetrics.data ?? []}
              previousSiteAnalytics={previousSiteAnalytics.data ?? []}
              goals={eventGoals}
              range={range}
            />
            </>}
          </TabsContent>
        </div>
      </Tabs>

    </div>
  );
}
