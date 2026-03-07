import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, addDays } from "date-fns";

interface YearOverYearChartProps {
  tickets: any[];
  currentEventId: string;
  previousEventId: string;
}

interface WeekData {
  week: number;
  total: number;
  weekStart: Date;
  weekEnd: Date;
}

function groupByRelativeWeek(tickets: any[]): WeekData[] {
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
    .map(([week, d]) => ({ week, total: d.total, weekStart: d.weekStart, weekEnd: d.weekEnd }));
}

function fmtDate(d: Date) {
  return format(d, "dd/MM/yy");
}

export function YearOverYearChart({ tickets, currentEventId, previousEventId }: YearOverYearChartProps) {
  const chartData = useMemo(() => {
    const currentTickets = tickets.filter((t) => t.event_id === currentEventId);
    const previousTickets = tickets.filter((t) => t.event_id === previousEventId);

    const currentWeeks = groupByRelativeWeek(currentTickets);
    const previousWeeks = groupByRelativeWeek(previousTickets);

    const maxWeek = Math.max(
      currentWeeks.length > 0 ? currentWeeks[currentWeeks.length - 1].week : 0,
      previousWeeks.length > 0 ? previousWeeks[previousWeeks.length - 1].week : 0
    );

    if (maxWeek === 0) return [];

    const currentMap = new Map(currentWeeks.map((w) => [w.week, w]));
    const previousMap = new Map(previousWeeks.map((w) => [w.week, w]));

    const data = [];
    let lastCurrent = 0;
    let lastPrevious = 0;

    for (let w = 1; w <= maxWeek; w++) {
      if (currentMap.has(w)) lastCurrent = currentMap.get(w)!.total;
      if (previousMap.has(w)) lastPrevious = previousMap.get(w)!.total;

      const cw = currentMap.get(w);
      const pw = previousMap.get(w);

      // Build label from current event dates, fallback to previous
      const ref = cw || pw;
      const label = ref
        ? `${fmtDate(ref.weekStart)} - ${fmtDate(ref.weekEnd)}`
        : `Sem ${w}`;

      data.push({
        week: label,
        weekNum: w,
        current: cw || w <= (currentWeeks.length > 0 ? currentWeeks[currentWeeks.length - 1].week : 0) ? lastCurrent : null,
        previous: pw || w <= (previousWeeks.length > 0 ? previousWeeks[previousWeeks.length - 1].week : 0) ? lastPrevious : null,
        currentDates: cw ? `${fmtDate(cw.weekStart)} - ${fmtDate(cw.weekEnd)}` : null,
        previousDates: pw ? `${fmtDate(pw.weekStart)} - ${fmtDate(pw.weekEnd)}` : null,
      });
    }

    return data;
  }, [tickets, currentEventId, previousEventId]);

  if (chartData.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    return (
      <div
        style={{
          backgroundColor: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: 8,
          padding: "8px 12px",
          color: "hsl(var(--foreground))",
        }}
      >
        <p className="text-sm font-medium mb-1">Semana {d?.weekNum}</p>
        {d?.current != null && (
          <p className="text-sm" style={{ color: "hsl(var(--primary))" }}>
            Atual: {d.current} {d.currentDates && `(${d.currentDates})`}
          </p>
        )}
        {d?.previous != null && (
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Anterior: {d.previous} {d.previousDates && `(${d.previousDates})`}
          </p>
        )}
      </div>
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
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
              angle={-30}
              textAnchor="end"
              height={60}
              interval={Math.max(0, Math.floor(chartData.length / 10))}
            />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="current"
              name="Evento Atual"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
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
