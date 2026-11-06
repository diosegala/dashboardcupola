import { PageHeader } from "@/components/PageHeader";
import { Chip } from "@/components/Chip";
import { goalsOfEvent, isEventClosed, useEvent } from "@/hooks/useEvent";
import { useMemo, useState } from "react";
import { coversWholeEvent, previousYear, ticketsInPeriod } from "@/lib/period";
import { Skeleton } from "@/components/ui/skeleton";
import { CommercialOverview } from "@/components/dashboard/CommercialOverview";
import { CommercialSegments } from "@/components/dashboard/CommercialSegments";
import { CompareProvider } from "@/hooks/useCompare";
import { CompareToggle } from "@/components/CompareToggle";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { MarketingTabs } from "@/components/marketing/MarketingTabs";
import {
  getDefaultRange,
  getWholeRange,
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

export type PaginaDoPainel = "comercial" | "marketing";

const TITULOS: Record<PaginaDoPainel, { titulo: string; descricao: string }> = {
  comercial: { titulo: "Comercial", descricao: "Vendas, receita e ritmo do evento" },
  marketing: { titulo: "Marketing", descricao: "Mídia, e-mail, site e os links que trazem as vendas" },
};

// O período escolhido vale para as duas páginas: trocar entre Comercial e Marketing não o reinicia.
// Sem escolha, o Comercial abre no evento inteiro e o Marketing no mês atual.
let periodoLembrado: DateRange | null = null;

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

// Comercial e Marketing são páginas próprias no menu lateral; cada uma mostra o conteúdo que antes ficava em uma aba.
export default function Dashboard({ pagina }: { pagina: PaginaDoPainel }) {
  const [range, setRangeState] = useState<DateRange>(() => periodoLembrado ?? (pagina === "comercial" ? getWholeRange() : getDefaultRange()));
  const setRange = (r: DateRange) => {
    periodoLembrado = r;
    setRangeState(r);
  };

  const { event, events, isLoading: eventLoading } = useEvent();
  // Ano do evento anterior (o que a comparação usa); vazio quando não há evento anterior.
  const anterior = events.find((e) => e.slug === event.previous_event_slug);
  const rotuloAnterior = anterior ? anterior.name.match(/\b(20\d{2})\b/)?.[1] ?? anterior.end_date.slice(0, 4) : "";
  const currentEventId = event.sympla_event_id ?? "";
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
  // Vendas do evento atual dentro do período (e o mesmo período do evento anterior, para comparar).
  const todas = allTimeTickets.data ?? [];
  const periodTickets = useMemo(() => ticketsInPeriod(todas, range), [todas, range]);
  const previousPeriodTickets = useMemo(() => ticketsInPeriod(previousTickets.data ?? [], previousYear(range)), [previousTickets.data, range]);
  const filtrado = !coversWholeEvent(range, todas);
  const eventParams = {
    eventDate: new Date(`${event.start_date ?? event.end_date}T00:00:00`),
  };

  // Cada página espera só os dados que usa; o cabeçalho aparece na hora.
  const comercialLoading = eventLoading || goals.isLoading || allTimeTickets.isLoading;
  const marketingLoading = goals.isLoading || adMetrics.isLoading || emailCampaigns.isLoading || siteAnalytics.isLoading || ga4Events.isLoading || allTimeTickets.isLoading;

  const { titulo, descricao } = TITULOS[pagina];

  return (
    <CompareProvider rotulo={rotuloAnterior}>
    <div>
      <PageHeader
        title={titulo}
        badge={encerrado ? <Chip variant="neutral">Encerrado</Chip> : undefined}
        description={descricao}
        actions={
          <>
            <CompareToggle />
            <PeriodSelector range={range} onChange={setRange} />
          </>
        }
      />

      <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
        {pagina === "comercial" ? (
          <div className="animate-panel-in">
            {comercialLoading ? <TabSkeleton /> : (
              <div className="space-y-8">
                <CommercialOverview
                  tickets={todas}
                  periodTickets={periodTickets}
                  previousPeriodTickets={previousPeriodTickets}
                  filtrado={filtrado}
                  goals={eventGoals}
                  previousTickets={previousTickets.data ?? []}
                  eventParams={eventParams}
                />
                <CommercialSegments tickets={periodTickets} goals={eventGoals} />
              </div>
            )}
          </div>
        ) : (
          <div className="animate-panel-in space-y-8">
            {marketingLoading ? <TabSkeleton /> : <>
            <MarketingTabs
              adMetrics={adMetrics.data ?? []}
              emailCampaigns={emailCampaigns.data ?? []}
              siteAnalytics={siteAnalytics.data ?? []}
              ga4Events={ga4Events.data ?? []}
              previousAdMetrics={previousAdMetrics.data ?? []}
              previousSiteAnalytics={previousSiteAnalytics.data ?? []}
              goals={eventGoals}
              range={range}
              tickets={periodTickets}
              allTickets={todas}
            />
            </>}
          </div>
        )}
      </div>
    </div>
    </CompareProvider>
  );
}
