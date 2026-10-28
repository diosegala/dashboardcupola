import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/CountUp";
import { IssuedTicketsCard } from "./IssuedTicketsCard";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { useCommercialMetrics, type EventParams, type PaceStatus } from "@/hooks/useCommercialMetrics";
import { CURRENT_PACE_DAYS } from "@/lib/eventConfig";
import { cn } from "@/lib/utils";
import { ChartLegend } from "./charts/ChartLegend";
import { PREVIOUS_YEAR_KEY, PREVIOUS_YEAR_LABEL, previousYearLineProps, useSeriesVisibility } from "./charts/chartSeries";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) =>
  n >= 100000
    ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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

function KpiCard({ title, value, format, unit, footer, className }: { title: string; value: number; format: (n: number) => string; unit?: string; footer?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-2.5 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        {title}
        <InfoTip title={title} />
      </div>
      <div className="whitespace-nowrap text-[clamp(24px,2.4vw,36px)] font-semibold leading-[1.1] tracking-[-0.035em]">
        <CountUp value={value} format={format} />
        {unit && <small className="ml-1 text-sm font-medium tracking-normal text-muted-foreground">{unit}</small>}
      </div>
      {footer && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}

function GoalRing({ progress: target }: { progress: number }) {
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
  tickets: any[];
  goals: any[];
  previousTickets?: any[];
  eventParams?: EventParams;
}

export function CommercialOverview({ tickets, goals, previousTickets = [], eventParams }: CommercialOverviewProps) {
  const m = useCommercialMetrics(tickets, goals, previousTickets, eventParams);
  const weeklySeries = useSeriesVisibility();
  const chip = PACE_CHIP[m.paceStatus];

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      {/* Linha 1: meta, ritmo necessário e ritmo atual */}
      <Card className="col-span-12 flex flex-col gap-3 border-[#0F1114] bg-[#0F1114] p-5 text-[#F5F2EB] dark:border-[#2d3a10] dark:shadow-glow lg:col-span-6">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#D6D2C8]">
          Meta de ingressos pagantes
          <InfoTip title="Meta de ingressos pagantes" className="text-[#D6D2C8]" />
        </div>
        <div className="flex items-center gap-5">
          <GoalRing progress={m.progress} />
          <div className="min-w-0">
            <div className="text-[clamp(32px,3.8vw,42px)] font-semibold leading-none tracking-[-0.035em]">
              <CountUp value={m.payingCount} format={int} />
              <small className="ml-1.5 text-sm font-medium tracking-normal text-[#9A9FA7]">de {int(m.goal)}</small>
            </div>
            <p className="mt-2 text-xs text-[#9A9FA7]">
              Faltam <b className="font-semibold text-[#B0F90A]">{int(m.missing)}</b> ingressos pagantes
            </p>
          </div>
        </div>
      </Card>

      <KpiCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title="Ritmo necessário"
        value={Math.ceil(m.requiredPace)}
        format={int}
        unit="por dia útil"
        footer={<span>{int(m.remainingDays)} dias úteis até o evento</span>}
      />
      <KpiCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title="Ritmo atual"
        value={m.currentPace}
        format={(n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        unit="por dia útil"
        footer={<Chip variant={chip.variant}>{chip.label}</Chip>}
      />

      {/* Linha 2: todos os ingressos emitidos (pizza) e receita */}
      <IssuedTicketsCard tickets={tickets} className="col-span-12 lg:col-span-8" />
      <KpiCard
        className="col-span-12 lg:col-span-4"
        title="Receita acumulada"
        value={m.revenue}
        format={brl}
        footer={<span>Ticket médio {brl(m.payingCount > 0 ? m.revenue / m.payingCount : 0)}</span>}
      />

      {/* Linha 3: pagantes acumulados x trajetória */}
      <Card className="col-span-12">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Pagantes acumulados x meta <InfoTip title="Pagantes acumulados x meta" />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Semanas desde a primeira venda</p>
          </div>
          <ChartLegend
            items={[
              { key: "pagantes", label: "Pagantes", color: COLORS.blue, shape: "line" },
              { key: "trajetoria", label: "Trajetória da meta", color: COLORS.muted, shape: "dashed" },
              ...(m.hasPrevious ? [{ key: PREVIOUS_YEAR_KEY, label: PREVIOUS_YEAR_LABEL, color: COLORS.muted, shape: "dashed" as const }] : []),
            ]}
            hidden={weeklySeries.hidden}
            onToggle={weeklySeries.toggle}
            onFocus={weeklySeries.setFocused}
          />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={m.weekly} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => int(v)} className="fill-muted-foreground" />
              <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [int(v), n]} />
              <Line
                dataKey="trajetoria"
                name="Trajetória da meta"
                stroke={COLORS.muted}
                strokeWidth={1.25}
                strokeDasharray="4 4"
                dot={false}
                hide={weeklySeries.hidden.has("trajetoria")}
                strokeOpacity={weeklySeries.opacity("trajetoria", 0.8)}
                animationDuration={1000}
              />
              {m.hasPrevious && (
                <Line
                  {...previousYearLineProps}
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
                dot={{ r: 2.5 }}
                connectNulls={false}
                hide={weeklySeries.hidden.has("pagantes")}
                strokeOpacity={weeklySeries.opacity("pagantes")}
                animationDuration={1200}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Linha 4: vendas por dia útil */}
      <Card className="col-span-12">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Vendas por dia útil <InfoTip title="Vendas por dia útil" />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Últimos 15 dias úteis</p>
          </div>
          <div className="flex flex-wrap gap-3.5 text-xs text-foreground/75">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS.blue }} /> No ritmo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COLORS.amber }} /> Abaixo
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.dailyBusiness} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                {...tooltipStyle}
                cursor={{ fill: "hsl(var(--secondary))" }}
                formatter={(v: number) => [int(v), "Pagantes"]}
              />
              <ReferenceLine
                y={m.requiredPace}
                stroke={COLORS.muted}
                strokeDasharray="4 4"
                label={{ value: `Necessário ${int(Math.ceil(m.requiredPace))}`, position: "insideTopRight", fontSize: 11, fill: COLORS.muted }}
              />
              <Bar dataKey="pagantes" radius={[6, 6, 0, 0]} animationDuration={900}>
                {m.dailyBusiness.map((d) => (
                  <Cell key={d.date} fill={d.onPace ? COLORS.blue : COLORS.amber} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">
            Ritmo atual considera a média dos últimos {CURRENT_PACE_DAYS} dias úteis. Feriados nacionais e fins de semana ficam de fora.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
