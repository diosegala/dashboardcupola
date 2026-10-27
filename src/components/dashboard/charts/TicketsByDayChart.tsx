import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { addYears, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChartLegend } from "./ChartLegend";
import { PREVIOUS_YEAR_KEY, PREVIOUS_YEAR_LABEL, previousYearLineProps, useSeriesVisibility } from "./chartSeries";

interface TicketsByDayChartProps {
  tickets: any[];
  // Vendas do evento anterior (base guardada). As datas são levadas um ano à frente para alinhar com o período atual.
  previousYearTickets?: any[];
}

const CURRENT_KEY = "ingressos";

function countByDay(tickets: any[], shiftYears = 0) {
  const map = new Map<string, number>();
  tickets.forEach((t) => {
    if (!t.sold_at) return;
    const day = format(addYears(new Date(t.sold_at), shiftYears), "yyyy-MM-dd");
    map.set(day, (map.get(day) || 0) + (t.quantity || 0));
  });
  return map;
}

export function TicketsByDayChart({ tickets, previousYearTickets }: TicketsByDayChartProps) {
  const series = useSeriesVisibility();

  const { data, hasPrevious } = useMemo(() => {
    const current = countByDay(tickets);
    const previousAll = countByDay(previousYearTickets ?? [], 1);
    // Só os dias do período atual recebem o valor do ano anterior.
    const days = Array.from(current.keys()).sort();
    const first = days[0];
    const last = days[days.length - 1];
    const previous = new Map(Array.from(previousAll).filter(([d]) => first && d >= first && d <= last));
    const allDays = Array.from(new Set([...days, ...previous.keys()])).sort();
    return {
      hasPrevious: previous.size > 0,
      data: allDays.map((date) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        [CURRENT_KEY]: current.get(date) ?? 0,
        ...(previous.size > 0 ? { [PREVIOUS_YEAR_KEY]: previous.get(date) ?? 0 } : {}),
      })),
    };
  }, [tickets, previousYearTickets]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">Ingressos Vendidos por Dia <InfoTip title="Ingressos Vendidos por Dia" /></CardTitle>
        {hasPrevious && (
          <ChartLegend
            items={[
              { key: CURRENT_KEY, label: "Ingressos", color: "hsl(var(--data-blue))", shape: "line" },
              { key: PREVIOUS_YEAR_KEY, label: PREVIOUS_YEAR_LABEL, color: "hsl(var(--muted-foreground))", shape: "dashed" },
            ]}
            hidden={series.hidden}
            onToggle={series.toggle}
            onFocus={series.setFocused}
          />
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              {hasPrevious && (
                <Line
                  {...previousYearLineProps}
                  hide={series.hidden.has(PREVIOUS_YEAR_KEY)}
                  strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, previousYearLineProps.strokeOpacity)}
                />
              )}
              <Line
                type="monotone"
                dataKey={CURRENT_KEY}
                name="Ingressos"
                stroke="hsl(var(--data-blue))"
                strokeWidth={2}
                dot={false}
                hide={series.hidden.has(CURRENT_KEY)}
                strokeOpacity={series.opacity(CURRENT_KEY)}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado no período</p>
        )}
      </CardContent>
    </Card>
  );
}
