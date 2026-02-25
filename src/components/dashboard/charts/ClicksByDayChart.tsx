import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClicksByDayChartProps {
  adMetrics: any[];
}

export function ClicksByDayChart({ adMetrics }: ClicksByDayChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, { meta: number; google: number }>();
    adMetrics.forEach((a) => {
      const day = a.date;
      if (!map.has(day)) map.set(day, { meta: 0, google: 0 });
      const entry = map.get(day)!;
      if (a.source === "meta") entry.meta += a.clicks || 0;
      else entry.google += a.clicks || 0;
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        "Meta Ads": v.meta,
        "Google Ads": v.google,
      }));
  }, [adMetrics]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cliques por Dia (Meta + Google)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Meta Ads" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Google Ads" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de anúncios no período</p>
        )}
      </CardContent>
    </Card>
  );
}
