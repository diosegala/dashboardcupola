import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Chip } from "@/components/Chip";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareProvider } from "@/hooks/useCompare";
import { CompareToggle } from "@/components/CompareToggle";
import { goalsOfEvent, isEventClosed, useEvent } from "@/hooks/useEvent";
import { useAuth } from "@/hooks/useAuth";
import { useGoals } from "@/hooks/useDashboardData";
import { useSponsorshipConfig, useSponsorshipData } from "@/hooks/useSponsorship";
import { eventGoal } from "@/lib/goalMetrics";
import {
  EXAMPLE_GOALS,
  SPONSOR_GOAL_KEYS,
  addDays,
  computeSponsorship,
  exampleDataset,
  examplePrevious,
  quotaBreakdown,
  saoPauloDate,
  weeklySeries,
  type SponsorshipGoals,
} from "@/lib/sponsorshipMetrics";
import { SponsorRevenueCard } from "@/components/sponsorship/SponsorRevenueCard";
import { SponsorQuotasCard } from "@/components/sponsorship/SponsorQuotasCard";
import { SponsorPaceCard } from "@/components/sponsorship/SponsorPaceCard";
import { SponsorSalesCard } from "@/components/sponsorship/SponsorSalesCard";

const goalValue = (goals: any[], key: string) => {
  const g = eventGoal(goals, key);
  const v = g ? Number(g.target_value) : 0;
  return v > 0 ? v : null;
};

// Página Patrocínios: dashboard de leitura do evento escolhido no topo, no modelo da aba Comercial.
export default function Sponsorship() {
  const { isSeller } = useAuth();
  const { event, events, isLoading: eventLoading } = useEvent();
  const config = useSponsorshipConfig(event.id);
  const data = useSponsorshipData(config.data);
  const goalsQuery = useGoals();

  const anterior = events.find((e) => e.slug === event.previous_event_slug);
  const rotuloAnterior = anterior ? anterior.name.match(/\b(20\d{2})\b/)?.[1] ?? anterior.end_date.slice(0, 4) : "";
  const abertura = event.start_date ?? event.end_date;
  // A edição começa no dia seguinte ao último dia da edição anterior; sem anterior, um ano antes da abertura.
  const inicio = anterior ? addDays(anterior.end_date, 1) : addDays(abertura, -365);
  const hoje = saoPauloDate(new Date().toISOString());

  // Sem configuração ou sem negócios sincronizados, a página mostra dados de exemplo identificados como exemplo.
  const exemplo = !config.data?.crm_account || !config.data.pipelines.length || !data.data || data.data.deals.length === 0;

  const view = useMemo(() => {
    const window = { previousEnd: anterior?.end_date ?? null, eventEnd: event.end_date };
    const list = goalsOfEvent(goalsQuery.data ?? [], event) as any[];
    const realGoals: SponsorshipGoals = {
      ampliada: goalValue(list, SPONSOR_GOAL_KEYS.ampliada),
      minima: goalValue(list, SPONSOR_GOAL_KEYS.minima),
      orcamento: goalValue(list, SPONSOR_GOAL_KEYS.orcamento),
    };
    const realQuotaGoals: Record<string, number> = {};
    for (const g of list
      .filter((g) => g.metric_key === SPONSOR_GOAL_KEYS.cotas && g.quota_key)
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))) {
      realQuotaGoals[g.quota_key] = Number(g.target_value);
    }

    if (exemplo) {
      const ex = exampleDataset(config.data, inicio, hoje);
      const m = computeSponsorship(ex.config, ex.deals, ex.lines, ex.catalog, window);
      return { m, goals: EXAMPLE_GOALS, quotas: ex.config.quotas, quotaGoals: ex.quotaGoals, anterior: examplePrevious, account: null };
    }
    const m = computeSponsorship(config.data!, data.data!.deals, data.data!.lines, data.data!.catalog, window);
    // A edição anterior entra com a importação da planilha (fase 3); até lá a comparação fica oculta.
    return { m, goals: realGoals, quotas: config.data!.quotas, quotaGoals: realQuotaGoals, anterior: null, account: config.data!.crm_account };
  }, [exemplo, config.data, data.data, goalsQuery.data, event, anterior?.end_date, inicio, hoje]);

  const quotaRows = useMemo(() => quotaBreakdown(view.m, view.quotas, view.quotaGoals), [view]);
  const metaCotas = Object.values(view.quotaGoals).reduce((s, v) => s + v, 0) || null;
  const semanal = useMemo(
    () => weeklySeries(view.m, { inicio, abertura, hoje, meta: view.goals.ampliada, anterior: view.anterior }),
    [view, inicio, abertura, hoje],
  );
  // Acumulado da edição anterior no mesmo número de dias antes do evento.
  const diasAntes = Math.max(Math.round((Date.parse(`${abertura}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000), 0);
  const vendidoAnterior = view.anterior ? view.anterior(diasAntes) : null;

  if (isSeller) return <Navigate to="/" replace />;

  const loading = eventLoading || config.isLoading || goalsQuery.isLoading || (data.isLoading && data.fetchStatus !== "idle");

  return (
    <CompareProvider rotulo={rotuloAnterior}>
      <div>
        <PageHeader
          title="Patrocínios"
          badge={isEventClosed(event) ? <Chip variant="neutral">Encerrado</Chip> : undefined}
          description="Venda de cotas e receita de patrocínio do evento"
          actions={<CompareToggle />}
        />

        <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-80" />
            </div>
          ) : (
            <div className="animate-panel-in space-y-4">
              {exemplo && (
                <p className="rounded-2xl border border-dashed border-line-strong bg-card px-4 py-3 text-sm text-muted-foreground">
                  <b className="font-semibold text-foreground">Dados de exemplo.</b>{" "}
                  {!config.data?.crm_account || !config.data.pipelines.length
                    ? "O patrocínio deste evento ainda não foi configurado em Configurações › Eventos."
                    : "A integração com o Pipedrive ainda não trouxe negócios deste evento."}{" "}
                  Empresas, valores e metas abaixo são fictícios e servem só para ver o visual.
                </p>
              )}
              <div className="grid grid-cols-12 gap-[14px]">
                <SponsorRevenueCard
                  className="col-span-12"
                  vendido={view.m.vendido}
                  emNegociacao={view.m.emNegociacao}
                  negociosAbertos={view.m.negociosAbertos}
                  goals={view.goals}
                  anterior={vendidoAnterior}
                  exemplo={exemplo}
                />
                <SponsorQuotasCard className="col-span-12 lg:col-span-5" rows={quotaRows} />
                <SponsorPaceCard
                  className="col-span-12 lg:col-span-7"
                  semanas={semanal.semanas}
                  meta={view.goals.ampliada}
                  metaCotas={metaCotas}
                  ritmoSemanal={semanal.ritmoSemanal}
                  semanasRestantes={semanal.semanasRestantes}
                />
                <SponsorSalesCard className="col-span-12" metrics={view.m} account={view.account} />
              </div>
              {!exemplo && data.data?.lastSync && (
                <p className="text-right text-[11px] text-muted-foreground">
                  Atualizado em {new Date(data.data.lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </CompareProvider>
  );
}
