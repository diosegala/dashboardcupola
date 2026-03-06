import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

interface YearOverYearChartProps {
  tickets: any[];
  currentEventId: string;
  previousEventId: string;
}

function groupByRelativeWeek(tickets: any[]) {
  if (tickets.length === 0) return [];

  const sorted = [...tickets]
    .filter((t) => t.sold_at)
    .sort((a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime());

  if (sorted.length === 0) return [];

  const firstSale = new Date(sorted[0].sold_at).getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const weekMap = new Map<number, number>();
  let cumulative = 0;

  sorted.forEach((t) => {
    const week = Math.floor((new Date(t.sold_at).getTime() - firstSale) / msPerWeek) + 1;
    cumulative += t.quantity || 0;
    weekMap.set(week, cumulative);
  });

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));
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

    const currentMap = new Map(currentWeeks.map((w) => [w.week, w.total]));
    const previousMap = new Map(previousWeeks.map((w) => [w.week, w.total]));

    const data = [];
    let lastCurrent = 0;
    let lastPrevious = 0;

    for (let w = 1; w <= maxWeek; w++) {
      if (currentMap.has(w)) lastCurrent = currentMap.get(w)!;
      if (previousMap.has(w)) lastPrevious = previousMap.get(w)!;

      data.push({
        week: `Sem ${w}`,
        current: currentMap.has(w) || w <= (currentWeeks.length > 0 ? currentWeeks[currentWeeks.length - 1].week : 0) ? lastCurrent : null,
        previous: previousMap.has(w) || w <= (previousWeeks.length > 0 ? previousWeeks[previousWeeks.length - 1].week : 0) ? lastPrevious : null,
      });
    }

    return data;
  }, [tickets, currentEventId, previousEventId]);

  if (chartData.length === 0) {
    return null;
  }

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
            <XAxis dataKey="week" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
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
