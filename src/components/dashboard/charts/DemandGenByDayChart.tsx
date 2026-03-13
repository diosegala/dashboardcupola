import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DemandGenByDayChartProps {
  ga4Events: any[];
}

const DEMAND_EVENTS = [
  { key: "add_to_cart", label: "Add to Cart", color: "hsl(var(--chart-1))" },
  { key: "botao_sympla", label: "Botão Sympla", color: "hsl(var(--chart-2))" },
  { key: "botao_tabela", label: "Botão Tabela", color: "hsl(var(--chart-3))" },
  { key: "mais_infos_tp_mobile", label: "Mais Infos TP (Mobile)", color: "hsl(var(--chart-4))" },
];

const EVENT_KEYS = new Set(DEMAND_EVENTS.map((e) => e.key));

export function DemandGenByDayChart({ ga4Events }: DemandGenByDayChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of ga4Events) {
      if (!EVENT_KEYS.has(row.event_name)) continue;
      const existing = map.get(row.date) || {};
      existing[row.event_name] = (existing[row.event_name] || 0) + (row.event_count || 0);
      map.set(row.date, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        ...counts,
      }));
  }, [ga4Events]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Geração de Demanda por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Legend />
            {DEMAND_EVENTS.map((e) => (
              <Bar key={e.key} dataKey={e.key} name={e.label} fill={e.color} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
