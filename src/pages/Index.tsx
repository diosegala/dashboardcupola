import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { SalesSection } from "@/components/dashboard/SalesSection";
import { MarketingSection } from "@/components/dashboard/MarketingSection";
import {
  getDefaultRange,
  useTicketSales,
  useDeals,
  useAdMetrics,
  useEmailCampaigns,
  useSiteAnalytics,
  useGoals,
  useAllTimeTicketSales,
  type DateRange,
} from "@/hooks/useDashboardData";

export default function Index() {
  const [range, setRange] = useState<DateRange>(getDefaultRange);

  const tickets = useTicketSales(range);
  const deals = useDeals(range);
  const adMetrics = useAdMetrics(range);
  const emailCampaigns = useEmailCampaigns(range);
  const siteAnalytics = useSiteAnalytics(range);
  const goals = useGoals();
  const allTimeTickets = useAllTimeTicketSales();

  const isLoading = tickets.isLoading || deals.isLoading || adMetrics.isLoading || emailCampaigns.isLoading || siteAnalytics.isLoading || goals.isLoading || allTimeTickets.isLoading;

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
        <PeriodSelector range={range} onChange={setRange} />
      </div>

      <SalesSection
        tickets={tickets.data ?? []}
        deals={deals.data ?? []}
        goals={goals.data ?? []}
        allTimeTickets={allTimeTickets.data ?? []}
      />

      <Separator />

      <MarketingSection
        adMetrics={adMetrics.data ?? []}
        emailCampaigns={emailCampaigns.data ?? []}
        siteAnalytics={siteAnalytics.data ?? []}
        goals={goals.data ?? []}
      />
    </div>
  );
}
