import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Label } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, addDays } from "date-fns";

interface YearOverYearChartProps {
  tickets: any[];
  currentEventId: string;
  previousEventId: string;
}

interface WeekBucket {
  weekNum: number;
  total: number;
  weekStart: Date;
  weekEnd: Date;
}

function bucketByWeek(tickets: any[]): WeekBucket[] {
  const sorted = [...tickets]
    .filter((t) => t.sold_at)
    .sort((a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime());

  if (sorted.length === 0) return [];

  const firstSaleTime = new Date(sorted[0].sold_at).getTime();
  const firstSaleDate = new Date(sorted[0].sold_at);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const weekMap = new Map<number, { total: number; weekStart: Date; weekEnd: Date }>();

  sorted.forEach((t) => {
    const week = Math.floor((new Date(t.sold_at).getTime() - firstSaleTime) / msPerWeek) + 1;
    const existing = weekMap.get(week);
    const qty = t.quantity || 0;
    if (existing) {
      existing.total += qty;
    } else {
      const weekStart = addDays(firstSaleDate, (week - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      weekMap.set(week, { total: qty, weekStart, weekEnd });
    }
  });

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNum, d]) => ({ weekNum, ...d }));
}

function fmtDate(d: Date) {
  return format(d, "dd/MM/yy");
}

function fmtDateShort(d: Date) {
  return format(d, "dd/MM");
}

export function YearOverYearChart({ tickets, currentEventId, previousEventId }: YearOverYearChartProps) {
  const { chartData, monthBoundaries } = useMemo(() => {
    const currentBuckets = bucketByWeek(tickets.filter((t) => t.event_id === currentEventId));
    const previousBuckets = bucketByWeek(tickets.filter((t) => t.event_id === previousEventId));

    const maxWeek = Math.max(
      currentBuckets.length > 0 ? currentBuckets[currentBuckets.length - 1].weekNum : 0,
      previousBuckets.length > 0 ? previousBuckets[previousBuckets.length - 1].weekNum : 0
    );

    if (maxWeek === 0) return { chartData: [], monthBoundaries: [] };

    const currentMap = new Map(currentBuckets.map((w) => [w.weekNum, w]));
    const previousMap = new Map(previousBuckets.map((w) => [w.weekNum, w]));

    const maxCurrentWeek = currentBuckets.length > 0 ? currentBuckets[currentBuckets.length - 1].weekNum : 0;
    const maxPreviousWeek = previousBuckets.length > 0 ? previousBuckets[previousBuckets.length - 1].weekNum : 0;

    const data: any[] = [];
    const boundaries: number[] = [];

    for (let w = 1; w <= maxWeek; w++) {
      const cw = currentMap.get(w);
      const pw = previousMap.get(w);
      const weekInMonth = ((w - 1) % 4) + 1;
      const relativeMonth = Math.ceil(w / 4);

      if (weekInMonth === 1) {
        boundaries.push(w);
      }

      data.push({
        weekNum: w,
        weekInMonth,
        relativeMonth,
        monthLabel: `Mês ${relativeMonth}`,
        current: w <= maxCurrentWeek ? (cw?.total ?? 0) : null,
        previous: w <= maxPreviousWeek ? (pw?.total ?? 0) : null,
        currentDates: cw ? `${fmtDateShort(cw.weekStart)} - ${fmtDateShort(cw.weekEnd)}` : null,
        previousDates: pw ? `${fmtDateShort(pw.weekStart)} - ${fmtDateShort(pw.weekEnd)}` : null,
        currentDatesFull: cw ? `${fmtDate(cw.weekStart)} - ${fmtDate(cw.weekEnd)}` : null,
        previousDatesFull: pw ? `${fmtDate(pw.weekStart)} - ${fmtDate(pw.weekEnd)}` : null,
      });
    }

    return { chartData: data, monthBoundaries: boundaries };
  }, [tickets, currentEventId, previousEventId]);

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0]?.payload;
    return (
      <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-md">
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

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Comparação Ano a Ano — Ingressos por Semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ bottom: 40, left: 10, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

            {/* Month separators */}
            {monthBoundaries.slice(1).map((weekNum) => (
              <ReferenceLine
                key={`sep-${weekNum}`}
                x={weekNum}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
              />
            ))}

            {/* Month labels as reference lines at midpoint of each month block */}
            {monthBoundaries.map((startWeek, i) => {
              const endWeek = i < monthBoundaries.length - 1
                ? monthBoundaries[i + 1] - 1
                : chartData[chartData.length - 1]?.weekNum ?? startWeek;
              const midWeek = (startWeek + endWeek) / 2;
              const monthNum = Math.ceil(startWeek / 4);
              return (
                <ReferenceLine
                  key={`month-${startWeek}`}
                  x={midWeek}
                  stroke="transparent"
                  ifOverflow="extendDomain"
                >
                  <Label
                    value={`Mês ${monthNum}`}
                    position="bottom"
                    offset={28}
                    className="fill-muted-foreground"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  />
                </ReferenceLine>
              );
            })}

            <XAxis
              dataKey="weekNum"
              type="number"
              domain={[1, chartData[chartData.length - 1]?.weekNum ?? 1]}
              tickFormatter={(num: number) => `S${((num - 1) % 4) + 1}`}
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              interval={0}
              ticks={chartData.map((d: any) => d.weekNum)}
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
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="previous"
              name="Evento Anterior"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
