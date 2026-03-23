import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { findGoal, type DateRange } from "@/hooks/useDashboardData";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  isBefore,
  isAfter,
  format,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
} from "date-fns";

interface FunnelKPISectionProps {
  adMetrics: any[];
  emailCampaigns: any[];
  tickets: any[];
  goals: any[];
  range: DateRange;
}

interface FunnelRowDef {
  stage: "TOFU" | "MOFU" | "BOFU";
  label: string;
  metricKey: string;
  format?: "currency" | "number";
  note?: string;
}

interface WeekSlice {
  label: string;
  sub: string;
  from: Date;
  to: Date;
}

const stageBadgeClass: Record<string, string> = {
  TOFU: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MOFU: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  BOFU: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const ROW_DEFS: FunnelRowDef[] = [
  { stage: "TOFU", label: "Engajamento", metricKey: "funnel_tofu_engagement" },
  { stage: "MOFU", label: "Carrinho Mídia", metricKey: "funnel_mofu_cart" },
  { stage: "MOFU", label: "G.D Email", metricKey: "funnel_mofu_gd_email" },
  { stage: "MOFU", label: "G.D Mídia", metricKey: "funnel_mofu_gd_midia" },
  { stage: "BOFU", label: "Mensagens", metricKey: "funnel_bofu_messages", note: "Meta Ads" },
  { stage: "BOFU", label: "Todas Vendas", metricKey: "funnel_bofu_sales" },
  { stage: "BOFU", label: "Receita", metricKey: "funnel_bofu_revenue", format: "currency" },
];

function getWeeksInRange(from: Date, to: Date): WeekSlice[] {
  const weeks: WeekSlice[] = [];
  let weekStart = startOfWeek(from, { weekStartsOn: 1 });
  let idx = 1;

  while (isBefore(weekStart, to) || weekStart.getTime() === to.getTime()) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const clampedStart = isAfter(weekStart, from) ? weekStart : from;
    const clampedEnd = isBefore(weekEnd, to) ? weekEnd : to;

    weeks.push({
      label: `S${idx}`,
      sub: `${format(clampedStart, "dd/MM")}–${format(clampedEnd, "dd/MM")}`,
      from: startOfDay(clampedStart),
      to: endOfDay(clampedEnd),
    });

    weekStart = addWeeks(weekStart, 1);
    idx++;
  }

  return weeks;
}

function isInRange(dateStr: string | null, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

function calcActual(
  def: FunnelRowDef,
  metaAds: any[],
  emailCampaigns: any[],
  tickets: any[],
  from: Date,
  to: Date
): number {
  const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);

  const filteredMeta = metaAds.filter((a) => isInRange(a.date, from, to));
  const filteredEmail = emailCampaigns.filter((a) => isInRange(a.sent_at, from, to));
  const filteredTickets = tickets.filter((a) => isInRange(a.sold_at, from, to));

  switch (def.metricKey) {
    case "funnel_tofu_engagement":
      return sum(filteredMeta, "post_engagement");
    case "funnel_mofu_cart":
      return sum(filteredMeta, "add_to_cart");
    case "funnel_mofu_gd_email":
      return sum(filteredEmail, "total_clicked");
    case "funnel_mofu_gd_midia":
      return sum(filteredMeta, "link_clicks");
    case "funnel_bofu_messages":
      return sum(filteredMeta, "messages");
    case "funnel_bofu_sales":
      return sum(filteredTickets, "quantity");
    case "funnel_bofu_revenue":
      return sum(filteredTickets, "total_price");
    default:
      return 0;
  }
}

const fmtVal = (value: number, fmt?: "currency" | "number") => {
  if (fmt === "currency") return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return value.toLocaleString("pt-BR");
};

export function FunnelKPISection({ adMetrics, emailCampaigns, tickets, goals, range }: FunnelKPISectionProps) {
  const metaAds = useMemo(() => adMetrics.filter((a) => a.source === "meta"), [adMetrics]);

  const weeks = useMemo(() => getWeeksInRange(range.from, range.to), [range]);
  const showWeeks = weeks.length > 1;

  // Precompute actuals per period (total + per week)
  const data = useMemo(() => {
    return ROW_DEFS.map((def) => {
      const totalActual = calcActual(def, metaAds, emailCampaigns, tickets, range.from, range.to);
      const weekActuals = weeks.map((w) => calcActual(def, metaAds, emailCampaigns, tickets, w.from, w.to));
      return { def, totalActual, weekActuals };
    });
  }, [metaAds, emailCampaigns, tickets, weeks, range]);

  const colCount = showWeeks ? 2 + (1 + weeks.length) * 2 : 5; // etapa+obj + (total + weeks) * (meta+real)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Funil de KPIs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Top header row */}
              <tr className="border-b">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-card text-left py-2 px-3 font-medium text-muted-foreground border-r"
                >
                  Etapa
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[72px] z-20 bg-card text-left py-2 px-3 font-medium text-muted-foreground border-r"
                >
                  Objetivo
                </th>
                <th
                  colSpan={2}
                  className="text-center py-2 px-3 font-semibold border-r bg-muted/30"
                >
                  Período Total
                </th>
                {showWeeks &&
                  weeks.map((w) => (
                    <th
                      key={w.label}
                      colSpan={2}
                      className="text-center py-2 px-3 font-medium border-r last:border-r-0"
                    >
                      {w.label}
                    </th>
                  ))}
              </tr>
              {/* Sub header row */}
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-1 px-3 text-right border-r bg-muted/30 font-normal">Meta</th>
                <th className="py-1 px-3 text-right border-r bg-muted/30 font-normal">Real.</th>
                {showWeeks &&
                  weeks.map((w) => (
                    <>
                      <th key={`${w.label}-m`} className="py-1 px-3 text-right font-normal whitespace-nowrap">
                        Meta
                      </th>
                      <th key={`${w.label}-r`} className="py-1 px-3 text-right border-r last:border-r-0 font-normal whitespace-nowrap">
                        Real.
                      </th>
                    </>
                  ))}
              </tr>
              {/* Week date labels */}
              {showWeeks && (
                <tr className="border-b text-[10px] text-muted-foreground/70">
                  <th className="sticky left-0 z-20 bg-card border-r" />
                  <th className="sticky left-[72px] z-20 bg-card border-r" />
                  <th colSpan={2} className="py-0.5 text-center border-r bg-muted/30">
                    {format(range.from, "dd/MM")}–{format(range.to, "dd/MM")}
                  </th>
                  {weeks.map((w) => (
                    <th key={`${w.label}-d`} colSpan={2} className="py-0.5 text-center border-r last:border-r-0 whitespace-nowrap">
                      {w.sub}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {data.map(({ def, totalActual, weekActuals }) => {
                const totalGoal = findGoal(goals, def.metricKey, range);
                const totalTarget = totalGoal ? Number(totalGoal.target_value) : null;
                const totalPct = totalTarget && totalTarget > 0 ? (totalActual / totalTarget) * 100 : null;

                return (
                  <tr key={def.metricKey} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card py-2.5 px-3 border-r">
                      <Badge variant="secondary" className={stageBadgeClass[def.stage]}>
                        {def.stage}
                      </Badge>
                    </td>
                    <td className="sticky left-[72px] z-10 bg-card py-2.5 px-3 border-r">
                      <span className="font-medium text-xs whitespace-nowrap">{def.label}</span>
                      {def.note && (
                        <span className="text-[10px] text-muted-foreground ml-1">({def.note})</span>
                      )}
                    </td>
                    {/* Total period */}
                    <td className="py-2.5 px-3 text-right tabular-nums bg-muted/10 border-r text-xs">
                      {totalTarget != null ? fmtVal(totalTarget, def.format) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-semibold bg-muted/10 border-r text-xs ${
                      totalTarget != null
                        ? totalActual >= totalTarget
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                        : ""
                    }`}>
                      {fmtVal(totalActual, def.format)}
                      {totalPct != null && (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {totalPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    {/* Weekly columns */}
                    {showWeeks &&
                      weeks.map((w, i) => {
                        const weekRange: DateRange = { from: w.from, to: w.to };
                        const weekGoal = findGoal(goals, def.metricKey, weekRange);
                        const weekTarget = weekGoal ? Number(weekGoal.target_value) : null;
                        const actual = weekActuals[i];
                        const metColor =
                          weekTarget != null
                            ? actual >= weekTarget
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                            : "";

                        return (
                          <>
                            <td key={`${w.label}-m`} className="py-2.5 px-3 text-right tabular-nums text-xs">
                              {weekTarget != null ? fmtVal(weekTarget, def.format) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td
                              key={`${w.label}-r`}
                              className={`py-2.5 px-3 text-right tabular-nums font-semibold border-r last:border-r-0 text-xs ${metColor}`}
                            >
                              {fmtVal(actual, def.format)}
                            </td>
                          </>
                        );
                      })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
