import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SessionsByDayChartProps {
  siteAnalytics: any[];
}

export function SessionsByDayChart({ siteAnalytics }: SessionsByDayChartProps) {
  const data = useMemo(() => {
    return siteAnalytics.map((s) => ({
      date: s.date,
      label: format(parseISO(s.date), "dd/MM", { locale: ptBR }),
      sessões: s.sessions || 0,
    }));
  }, [siteAnalytics]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sessões do Site por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="sessões" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de analytics no período</p>
        )}
      </CardContent>
    </Card>
  );
}
