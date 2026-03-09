import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClicksByDayChartProps {
  adMetrics: any[];
}

export function ClicksByDayChart({ adMetrics }: ClicksByDayChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    adMetrics
      .filter((a) => a.source === "meta")
      .forEach((a) => {
        const day = a.date;
        map.set(day, (map.get(day) || 0) + (a.link_clicks || a.clicks || 0));
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, clicks]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        "Meta Ads": clicks,
      }));
  }, [adMetrics]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cliques por Dia (Meta Ads)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="Meta Ads" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de anúncios no período</p>
        )}
      </CardContent>
    </Card>
  );
}
