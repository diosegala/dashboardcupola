import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDay } from "date-fns";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom

interface TicketsByWeekdayChartProps {
  tickets: any[];
}

export function TicketsByWeekdayChart({ tickets }: TicketsByWeekdayChartProps) {
  const data = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    tickets.forEach((t) => {
      if (!t.sold_at) return;
      const day = getDay(new Date(t.sold_at));
      counts[day] += t.quantity || 0;
    });
    return MONDAY_FIRST.map((d) => ({
      day: WEEKDAY_LABELS[d],
      ingressos: counts[d],
    }));
  }, [tickets]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendas por Dia da Semana (histórico)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.some((d) => d.ingressos > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Bar dataKey="ingressos" fill="hsl(var(--data-blue))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado disponível</p>
        )}
      </CardContent>
    </Card>
  );
}
