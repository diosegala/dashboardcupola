import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, addDays } from "date-fns";

interface YearOverYearChartProps {
  tickets: any[];
  currentEventId: string;
  previousEventId: string;
}

interface RelativeWeekData {
  relativeWeek: number; // 1-based global week
  relativeMonth: number; // 1-based month (every 4 weeks)
  weekInMonth: number; // 1-4
  total: number;
  weekStart: Date;
  weekEnd: Date;
}

function groupByRelativeWeek(tickets: any[]): RelativeWeekData[] {
  if (tickets.length === 0) return [];

  const sorted = [...tickets]
    .filter((t) => t.sold_at)
    .sort((a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime());

  if (sorted.length === 0) return [];

  const firstSale = new Date(sorted[0].sold_at);
  const firstSaleTime = firstSale.getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const weekMap = new Map<number, { total: number; weekStart: Date; weekEnd: Date }>();
  let cumulative = 0;

  sorted.forEach((t) => {
    const week = Math.floor((new Date(t.sold_at).getTime() - firstSaleTime) / msPerWeek) + 1;
    cumulative += t.quantity || 0;
    const weekStart = addDays(firstSale, (week - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    weekMap.set(week, { total: cumulative, weekStart, weekEnd });
  });

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, d]) => ({
      relativeWeek: week,
      relativeMonth: Math.ceil(week / 4),
      weekInMonth: ((week - 1) % 4) + 1,
      total: d.total,
      weekStart: d.weekStart,
      weekEnd: d.weekEnd,
    }));
}

function fmtDate(d: Date) {
  return format(d, "dd/MM/yy");
}

function fmtDateShort(d: Date) {
  return format(d, "dd/MM");
}

export function YearOverYearChart({ tickets, currentEventId, previousEventId }: YearOverYearChartProps) {
  const { chartData, monthBoundaries } = useMemo(() => {
    const currentTickets = tickets.filter((t) => t.event_id === currentEventId);
    const previousTickets = tickets.filter((t) => t.event_id === previousEventId);

    const currentWeeks = groupByRelativeWeek(currentTickets);
    const previousWeeks = groupByRelativeWeek(previousTickets);

    const maxWeek = Math.max(
      currentWeeks.length > 0 ? currentWeeks[currentWeeks.length - 1].relativeWeek : 0,
      previousWeeks.length > 0 ? previousWeeks[previousWeeks.length - 1].relativeWeek : 0
    );

    if (maxWeek === 0) return { chartData: [], monthBoundaries: [] };

    const currentMap = new Map(currentWeeks.map((w) => [w.relativeWeek, w]));
    const previousMap = new Map(previousWeeks.map((w) => [w.relativeWeek, w]));

    const data: any[] = [];
    const boundaries: { index: number; label: string }[] = [];
    let lastCurrent = 0;
    let lastPrevious = 0;
    let lastMonth = 0;

    const maxCurrentWeek = currentWeeks.length > 0 ? currentWeeks[currentWeeks.length - 1].relativeWeek : 0;
    const maxPreviousWeek = previousWeeks.length > 0 ? previousWeeks[previousWeeks.length - 1].relativeWeek : 0;

    for (let w = 1; w <= maxWeek; w++) {
      if (currentMap.has(w)) lastCurrent = currentMap.get(w)!.total;
      if (previousMap.has(w)) lastPrevious = previousMap.get(w)!.total;

      const cw = currentMap.get(w);
      const pw = previousMap.get(w);

      const relativeMonth = Math.ceil(w / 4);
      const weekInMonth = ((w - 1) % 4) + 1;

      // Track month boundaries for reference lines
      if (relativeMonth !== lastMonth) {
        boundaries.push({ index: w, label: `Mês ${relativeMonth}` });
        lastMonth = relativeMonth;
      }

      const weekLabel = `S${weekInMonth}`;

      data.push({
        weekLabel,
        weekNum: w,
        relativeMonth,
        weekInMonth,
        monthLabel: `Mês ${relativeMonth}`,
        current: w <= maxCurrentWeek ? lastCurrent : null,
        previous: w <= maxPreviousWeek ? lastPrevious : null,
        currentDates: cw ? `${fmtDateShort(cw.weekStart)} - ${fmtDateShort(cw.weekEnd)}` : null,
        previousDates: pw ? `${fmtDateShort(pw.weekStart)} - ${fmtDateShort(pw.weekEnd)}` : null,
        currentDatesFull: cw ? `${fmtDate(cw.weekStart)} - ${fmtDate(cw.weekEnd)}` : null,
        previousDatesFull: pw ? `${fmtDate(pw.weekStart)} - ${fmtDate(pw.weekEnd)}` : null,
        isFirstOfMonth: weekInMonth === 1,
      });
    }

    return { chartData: data, monthBoundaries: boundaries };
  }, [tickets, currentEventId, previousEventId]);

  if (chartData.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    return (
      <div
        className="rounded-lg border bg-card p-3 text-card-foreground shadow-md"
      >
        <p className="text-sm font-semibold mb-2">
          {d?.monthLabel} — Semana {d?.weekInMonth}
        </p>
        {d?.current != null && (
          <div className="flex items-center gap-2 text-sm mb-1">
            <span className="inline-block w-3 h-0.5 bg-primary rounded" />
            <span>
              Atual: <strong>{d.current.toLocaleString("pt-BR")}</strong>
              {d.currentDatesFull && (
                <span className="text-muted-foreground ml-1">({d.currentDatesFull})</span>
              )}
            </span>
          </div>
        )}
        {d?.previous != null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-muted-foreground rounded" />
            <span>
              Anterior: <strong>{d.previous.toLocaleString("pt-BR")}</strong>
              {d.previousDatesFull && (
                <span className="text-muted-foreground ml-1">({d.previousDatesFull})</span>
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Custom tick for the month axis - only render on first week of each month
  const MonthTick = ({ x, y, payload, index }: any) => {
    const d = chartData[index];
    if (!d || !d.isFirstOfMonth) return null;
    
    // Calculate width: 4 weeks worth of space (or remaining weeks)
    return (
      <text
        x={x}
        y={y + 12}
        textAnchor="start"
        className="fill-muted-foreground"
        fontSize={11}
        fontWeight={600}
      >
        {d.monthLabel}
      </text>
    );
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Comparação Ano a Ano — Ingressos (acumulado)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ bottom: 30, left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            
            {/* Month reference lines */}
            {monthBoundaries.slice(1).map((b) => (
              <ReferenceLine
                key={b.index}
                x={chartData[b.index - 1]?.weekLabel}
                stroke="hsl(var(--border))"
                strokeDasharray="2 2"
                xAxisId="week"
              />
            ))}

            {/* Week labels (S1, S2, S3, S4) */}
            <XAxis
              xAxisId="week"
              dataKey="weekLabel"
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              height={20}
              interval={0}
            />

            {/* Month labels */}
            <XAxis
              xAxisId="month"
              dataKey="weekLabel"
              tick={<MonthTick />}
              tickLine={false}
              axisLine={false}
              height={25}
              interval={0}
              orientation="bottom"
            />

            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              xAxisId="week"
              type="monotone"
              dataKey="current"
              name="Evento Atual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              xAxisId="week"
              type="monotone"
              dataKey="previous"
              name="Evento Anterior"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
