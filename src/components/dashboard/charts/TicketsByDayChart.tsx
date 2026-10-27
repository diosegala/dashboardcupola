import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketsByDayChartProps {
  tickets: any[];
}

export function TicketsByDayChart({ tickets }: TicketsByDayChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      if (!t.sold_at) return;
      const day = format(new Date(t.sold_at), "yyyy-MM-dd");
      map.set(day, (map.get(day) || 0) + (t.quantity || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, qty]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        ingressos: qty,
      }));
  }, [tickets]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">Ingressos Vendidos por Dia <InfoTip title="Ingressos Vendidos por Dia" /></CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="ingressos" stroke="hsl(var(--data-blue))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado no período</p>
        )}
      </CardContent>
    </Card>
  );
}
