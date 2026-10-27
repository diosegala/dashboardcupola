import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TicketsByTypeChartProps {
  tickets: any[];
}

export function TicketsByTypeChart({ tickets }: TicketsByTypeChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const type = t.ticket_type || "Outros";
      map.set(type, (map.get(type) || 0) + (t.quantity || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, qty]) => ({ type, quantidade: qty }));
  }, [tickets]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingressos por Tipo</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Bar dataKey="quantidade" fill="hsl(var(--data-blue))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado no período</p>
        )}
      </CardContent>
    </Card>
  );
}
