import { CurrentBatchCard } from "./CurrentBatchCard";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { brl as brlCompleto, useCouponTotals } from "./CouponKpis";
import { METRIC_INFO } from "@/lib/metricInfo";
import { ticketCategory } from "@/lib/ticketCategory";
import { PayingTicketsCard } from "./PayingTicketsCard";
import { CRM_DISCOUNT_HINT, crmDiscountCoverage } from "@/lib/invoicedTickets";
import { commercialDiscounts } from "@/lib/lotPrice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/CountUp";
import { IssuedTicketsCard } from "./IssuedTicketsCard";
import { PaceGauge } from "./PaceGauge";
import { SlidingTabsList } from "./SlidingTabsList";
import { WeekdayView } from "./charts/WeekdayView";
import { BusinessDaysView } from "./BusinessDaysView";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { splitTickets, useCommercialMetrics, type EventParams, type PaceStatus } from "@/hooks/useCommercialMetrics";
import { cn } from "@/lib/utils";
import { GoalMeter } from "@/components/GoalMeter";
import { CompareLine } from "@/components/CompareLine";
import { useCompare } from "@/hooks/useCompare";
import { eventGoal } from "@/lib/goalMetrics";
import { ChartLegend } from "./charts/ChartLegend";
import { PREVIOUS_YEAR_KEY, previousYearLineProps, useSeriesVisibility } from "./charts/chartSeries";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) =>
  n >= 100000
    ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brlEixo = (n: number) => (n >= 1000 ? `R$ ${Math.round(n / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(n)}`);

const PACE_CHIP: Record<PaceStatus, { label: string; variant: ChipVariant }> = {
  achieved: { label: "Meta atingida", variant: "paid" },
  above: { label: "Acima do ritmo", variant: "ok" },
  on_track: { label: "No ritmo", variant: "ok" },
  below: { label: "Abaixo do ritmo", variant: "warn" },
};

const COLORS = {
  blue: "hsl(var(--data-blue))",
  amber: "hsl(var(--warn))",
  muted: "hsl(var(--muted-foreground))",
  sympla: "hsl(var(--chart-1))",
  invoiced: "hsl(var(--chart-2))",
  bonus: "hsl(var(--chart-5))",
};

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--line-strong))",
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

export function GoalRing({ progress: target }: { progress: number }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24 shrink-0" role="img" aria-label={`${Math.round(progress * 100)}% da meta`}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="#2A2F36" strokeWidth="10" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="#B0F90A"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        transform="rotate(-90 48 48)"
        className="transition-[stroke-dashoffset] duration-[1200ms] ease-cupola motion-reduce:transition-none"
      />
      <text x="48" y="48" textAnchor="middle" dominantBaseline="central" fill="#F5F2EB" fontSize="18" fontWeight="600">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

interface CommercialOverviewProps {
  // Todas as vendas do evento: meta, ritmo e acumulados olham sempre o evento inteiro.
  tickets: any[];
  // Vendas dentro do período escolhido no topo: emitidos, receita, descontos e vendas por dia.
  periodTickets?: any[];
  // Mesmo período no evento anterior, para a comparação.
  previousPeriodTickets?: any[];
  // O período escolhido não cobre o evento inteiro.
  filtrado?: boolean;
  goals: any[];
  previousTickets?: any[];
  eventParams?: EventParams;
}

// Selo dos cards que não seguem o período (meta e acumulados).
function EventoInteiro({ escuro }: { escuro?: boolean }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", escuro ? "bg-white/10 text-[#D6D2C8]" : "bg-secondary text-muted-foreground")}>
      Evento inteiro
    </span>
  );
}

function totais(lista: any[]) {
  const { paying, bonus } = splitTickets(lista);
  const qtd = (l: any[]) => l.reduce((s, t) => s + (t.quantity || 0), 0);
  return { payingCount: qtd(paying), issuedCount: qtd(paying) + qtd(bonus), revenue: paying.reduce((s, t) => s + Number(t.total_price || 0), 0) };
}

export function CommercialOverview({ tickets, periodTickets, previousPeriodTickets = [], filtrado = false, goals, previousTickets = [], eventParams }: CommercialOverviewProps) {
  const m = useCommercialMetrics(tickets, goals, previousTickets, eventParams);
  // Sem período escolhido, os cards de período mostram o evento inteiro (mesmos números de antes).
  const doPeriodo = filtrado && periodTickets ? periodTickets : tickets;
  const p = useMemo(() => totais(doPeriodo), [doPeriodo]);
  const pAnterior = useMemo(() => (previousPeriodTickets.length ? totais(previousPeriodTickets) : null), [previousPeriodTickets]);
  const receita = filtrado ? p.revenue : m.revenue;
  const pagantes = filtrado ? p.payingCount : m.payingCount;
  const weeklySeries = useSeriesVisibility();
  const revenueSeries = useSeriesVisibility();
  const [diaVisao, setDiaVisao] = useState<"uteis" | "semana">("semana");
  const chipBase = m.paceStatus ? PACE_CHIP[m.paceStatus] : null;
  // Selo com a diferença entre o ritmo atual e o necessário.
  const difRitmo = m.requiredPace !== null ? m.currentPace - m.requiredPace : 0;
  const chip = chipBase && (m.paceStatus === "above" || m.paceStatus === "below")
    ? { ...chipBase, label: `${chipBase.label} · ${difRitmo > 0 ? "+" : "−"}${Math.abs(difRitmo).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia` }
    : chipBase;
  // Metas do evento definidas na tela Metas (sem elas, os cards ficam só com os números).
  const metaReceita = eventGoal(goals, "revenue");
  const metaEmitidos = eventGoal(goals, "issued_tickets");
  const temMeta = m.goal !== null;
  const temMetaReceita = m.revenueGoal !== null;
  // Comparação com o evento anterior só com a chave ligada.
  const { ativo: comparar, rotulo } = useCompare();
  const mostrarAnterior = comparar && m.hasPrevious;
  // Só separa as fontes nos gráficos quando já existe venda faturada internamente.
  const temInterno = m.invoicedCount > 0;

  // Descontos concedidos: cupons parciais + cortesias pelo preço cheio do lote, % sobre a receita bruta.
  const descontosComercial = useMemo(() => {
    const { paying, bonus } = splitTickets(doPeriodo);
    const receita = paying.reduce((s, t) => s + Number(t.total_price || 0), 0);
    return commercialDiscounts([...paying, ...bonus], receita);
  }, [doPeriodo]);
  // Ingressos de negócios abertos no CRM: não contam, aparecem listrados na pista dos pagantes.
  const emNegociacaoCrm = useMemo(() => tickets.filter((t) => ticketCategory(t) === "negociacao").reduce((s, t) => s + (t.quantity || 0), 0), [tickets]);
  const coberturaCrm = useMemo(() => crmDiscountCoverage(doPeriodo), [doPeriodo]);
  const mostrarDescontos = useCouponTotals(doPeriodo).comCupom > 0 || coberturaCrm.negocios > 0;

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      {/* Linha 1: meta, ritmo necessário e ritmo atual */}
      <PayingTicketsCard
        className="col-span-12 lg:col-span-6"
        sympla={m.paidSymplaCount}
        faturados={m.invoicedCount}
        emNegociacao={emNegociacaoCrm}
        meta={m.goal}
        anterior={mostrarAnterior ? m.anterior?.payingCount ?? null : null}
        rotuloAnterior={rotulo}
        extra={filtrado ? <EventoInteiro escuro /> : undefined}
      />

      <PaceGauge
        className="col-span-12 lg:col-span-6"
        currentPace={m.currentPace}
        requiredPace={m.requiredPace}
        remainingDays={m.remainingDays}
        chip={chip}
        ritmoAnterior={m.anterior?.currentPace}
        faltam={m.missing}
      />

      {/* Linha 2: todos os ingressos emitidos (pizza) e receita */}
      <IssuedTicketsCard
        tickets={doPeriodo}
        goal={filtrado ? null : metaEmitidos}
        emitidosAnterior={filtrado ? pAnterior?.issuedCount : m.anterior?.issuedCount}
        emitidosAtual={filtrado ? p.issuedCount : m.issuedCount}
        quando={filtrado ? "no mesmo período (aprovados)" : undefined}
        goals={goals}
        allTimeTickets={tickets}
        previousYearTickets={previousTickets}
        className="col-span-12 lg:col-span-5"
      />
      <CurrentBatchCard
        goals={goals}
        allTimeTickets={tickets}
        previousYearTickets={previousTickets}
        className="col-span-12 md:col-span-6 lg:col-span-3"
      />
      {/* Receita acumulada e Descontos concedidos num único card: ticket médio e pagantes lado a lado, descontos no rodapé. */}
      <Card className="col-span-12 flex flex-col gap-4 p-5 hover:-translate-y-[3px] hover:border-line-strong md:col-span-6 lg:col-span-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
            {filtrado ? "Receita no período" : "Receita acumulada"}
            <InfoTip title="Receita acumulada" />
          </div>
          <div className="whitespace-nowrap text-[clamp(28px,2.8vw,40px)] font-semibold leading-[1.1] tracking-[-0.035em]">
            <CountUp value={receita} format={brl} />
          </div>
          <CompareLine
            anterior={filtrado ? pAnterior?.revenue : m.anterior?.revenue}
            atual={receita}
            formato={brl}
            quando={filtrado ? "no mesmo período" : undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-secondary/60 px-3.5 py-3">
            <div className="text-[11px] text-muted-foreground">Ticket médio</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{brl(pagantes > 0 ? receita / pagantes : 0)}</div>
          </div>
          <div className="rounded-2xl bg-secondary/60 px-3.5 py-3">
            <div className="text-[11px] text-muted-foreground">Ingressos pagantes</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{int(pagantes)}</div>
          </div>
        </div>

        {/* A meta de receita é do evento inteiro: some quando o período é só uma parte. */}
        {!filtrado && m.revenueGoal !== null && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">{Math.round((m.revenue / m.revenueGoal) * 100)}% da meta</span>
            <span className="text-muted-foreground">
              {m.revenue >= m.revenueGoal ? "Meta atingida" : `Faltam ${brl(m.revenueGoal - m.revenue)}`}
            </span>
          </div>
        )}
        {!filtrado && metaReceita && Number(metaReceita.target_value) > 0 && (
          <GoalMeter actual={m.revenue} target={Number(metaReceita.target_value)} unit="brl" periodStart={metaReceita.period_start} periodEnd={metaReceita.period_end} />
        )}

        {mostrarDescontos && (
          <div className="mt-auto space-y-1 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                Descontos concedidos
                <InfoTip title="Descontos concedidos" text={METRIC_INFO["Descontos concedidos (Comercial)"]} />
              </div>
              <div className="text-lg font-semibold tabular-nums tracking-[-0.02em]">{brlCompleto(descontosComercial.total)}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              {(descontosComercial.pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da receita bruta ({brlCompleto(descontosComercial.bruta)})
            </div>
            {coberturaCrm.faltam > 0 && (
              <div className="text-xs text-warn">
                Para investigar no CRM: {coberturaCrm.faltam} de {coberturaCrm.negocios} {coberturaCrm.negocios === 1 ? "negócio faturado está" : "negócios faturados estão"} sem desconto preenchido. {CRM_DISCOUNT_HINT}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Linha 3: pagantes acumulados x trajetória */}
      <Card className="col-span-12">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {temMeta ? "Pagantes acumulados x meta" : "Pagantes acumulados"} <InfoTip title={temMeta ? "Pagantes acumulados x meta" : "Pagantes acumulados"} />
              {filtrado && <EventoInteiro />}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Semanas desde a primeira venda{mostrarAnterior && temInterno && " · ano anterior sem faturados internos (não há esse dado)"}
            </p>
          </div>
          <ChartLegend
            items={[
              { key: "pagantes", label: "Pagantes", color: COLORS.blue, shape: "line" },
              ...(temInterno ? [{ key: "sympla", label: "Sympla", color: COLORS.sympla, shape: "square" as const }, { key: "interno", label: "Faturado interno", color: COLORS.invoiced, shape: "square" as const }] : []),
              ...(temMeta ? [{ key: "trajetoria", label: "Trajetória da meta", color: COLORS.amber, shape: "dashed" as const }] : []),
              ...(mostrarAnterior ? [{ key: PREVIOUS_YEAR_KEY, label: rotulo, color: COLORS.muted, shape: "dotted" as const }] : []),
            ]}
            hidden={weeklySeries.hidden}
            onToggle={weeklySeries.toggle}
            onFocus={weeklySeries.setFocused}
          />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={m.weekly} margin={{ left: -12, right: 8, top: 8 }}>
              {/* Faixas empilhadas: quanto do total acumulado veio da Sympla e quanto foi faturado internamente. */}
              {temInterno && <Area dataKey="sympla" name="Sympla" stackId="fonte" stroke="none" fill={COLORS.sympla} fillOpacity={0.18} hide={weeklySeries.hidden.has("sympla")} isAnimationActive={false} />}
              {temInterno && <Area dataKey="interno" name="Faturado interno" stackId="fonte" stroke="none" fill={COLORS.invoiced} fillOpacity={0.45} hide={weeklySeries.hidden.has("interno")} isAnimationActive={false} />}
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => int(v)} className="fill-muted-foreground" />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [int(v), n]} />
              {temMeta && <Line
                dataKey="trajetoria"
                name="Trajetória da meta"
                stroke={COLORS.amber}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                hide={weeklySeries.hidden.has("trajetoria")}
                strokeOpacity={weeklySeries.opacity("trajetoria", 0.9)}
                animationDuration={1000}
              />}
              {mostrarAnterior && (
                <Line
                  {...previousYearLineProps}
                  name={rotulo}
                  strokeDasharray="2 4"
                  hide={weeklySeries.hidden.has(PREVIOUS_YEAR_KEY)}
                  strokeOpacity={weeklySeries.opacity(PREVIOUS_YEAR_KEY, 0.55)}
                />
              )}
              <Line
                dataKey="pagantes"
                name="Pagantes"
                stroke={COLORS.blue}
                strokeWidth={2.5}
                dot={false} activeDot={{ r: 3.5 }}
                connectNulls={false}
                hide={weeklySeries.hidden.has("pagantes")}
                strokeOpacity={weeklySeries.opacity("pagantes")}
                animationDuration={1200}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Linha 3b: receita acumulada x trajetória da meta de receita */}
      <Card className="col-span-12">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {temMetaReceita ? "Receita acumulada x meta" : "Receita acumulada"} <InfoTip title="Receita acumulada x meta" />
              {filtrado && <EventoInteiro />}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {temMetaReceita ? "Semanas desde a primeira venda" : "Defina a meta de receita na aba Metas"}
            </p>
          </div>
          <ChartLegend
            items={[
              { key: "receita", label: "Receita", color: COLORS.blue, shape: "line" },
              ...(temInterno ? [{ key: "receitaSympla", label: "Sympla", color: COLORS.sympla, shape: "square" as const }, { key: "receitaInterno", label: "Faturado interno", color: COLORS.invoiced, shape: "square" as const }] : []),
              ...(temMetaReceita ? [{ key: "trajetoria", label: "Trajetória da meta", color: COLORS.amber, shape: "dashed" as const }] : []),
              ...(mostrarAnterior ? [{ key: PREVIOUS_YEAR_KEY, label: rotulo, color: COLORS.muted, shape: "dotted" as const }] : []),
            ]}
            hidden={revenueSeries.hidden}
            onToggle={revenueSeries.toggle}
            onFocus={revenueSeries.setFocused}
          />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={m.weeklyRevenue} margin={{ left: 4, right: 8, top: 8 }}>
              {temInterno && <Area dataKey="receitaSympla" name="Sympla" stackId="fonte" stroke="none" fill={COLORS.sympla} fillOpacity={0.18} hide={revenueSeries.hidden.has("receitaSympla")} isAnimationActive={false} />}
              {temInterno && <Area dataKey="receitaInterno" name="Faturado interno" stackId="fonte" stroke="none" fill={COLORS.invoiced} fillOpacity={0.45} hide={revenueSeries.hidden.has("receitaInterno")} isAnimationActive={false} />}
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => brlEixo(v)} className="fill-muted-foreground" />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [brl(v), n]} />
              {temMetaReceita && <Line dataKey="trajetoria" name="Trajetória da meta" stroke={COLORS.amber} strokeWidth={2} strokeDasharray="6 4" dot={false} hide={revenueSeries.hidden.has("trajetoria")} strokeOpacity={revenueSeries.opacity("trajetoria", 0.9)} animationDuration={1000} />}
              {mostrarAnterior && (
                <Line {...previousYearLineProps} name={rotulo} strokeDasharray="2 4" hide={revenueSeries.hidden.has(PREVIOUS_YEAR_KEY)} strokeOpacity={revenueSeries.opacity(PREVIOUS_YEAR_KEY, 0.55)} />
              )}
              <Line dataKey="receita" name="Receita" stroke={COLORS.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 3.5 }} connectNulls={false} hide={revenueSeries.hidden.has("receita")} strokeOpacity={revenueSeries.opacity("receita")} animationDuration={1200} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Linha 4: vendas por dia (últimos dias úteis ou dia da semana) */}
      <Card className="col-span-12">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Vendas por dia <InfoTip title={diaVisao === "uteis" ? "Vendas por dia útil" : "Vendas por dia da semana"} />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {diaVisao === "uteis"
                ? (temMeta ? "Vendas em cada dia útil comparadas ao ritmo necessário" : "Vendas pagantes em cada dia útil")
                : filtrado ? "Vendas pagantes em cada dia da semana no período" : "Vendas pagantes em cada dia da semana desde a abertura das vendas"}
            </p>
          </div>
          <Tabs value={diaVisao} onValueChange={(v) => setDiaVisao(v as "uteis" | "semana")}>
            <SlidingTabsList value={diaVisao} className="h-9">
              <TabsTrigger value="semana" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
                Dia da semana
              </TabsTrigger>
              <TabsTrigger value="uteis" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
                Dias úteis
              </TabsTrigger>
            </SlidingTabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {diaVisao === "semana" ? (
            <WeekdayView tickets={doPeriodo} />
          ) : (
            <BusinessDaysView paidByDay={m.paidByDay} internoByDay={m.internoByDay} firstSaleDate={m.firstSaleDate} requiredPace={m.requiredPace} paidByDayAnterior={mostrarAnterior ? m.anterior?.paidByDay : undefined} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
