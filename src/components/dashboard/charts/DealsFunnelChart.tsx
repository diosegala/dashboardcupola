import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DealsFunnelChartProps {
  deals: any[];
}

export function DealsFunnelChart({ deals }: DealsFunnelChartProps) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach((d) => {
      const stage = d.stage_name || "Sem estágio";
      map.set(stage, (map.get(stage) || 0) + 1);
    });
    return Array.from(map.entries()).map(([stage, count]) => ({ stage, deals: count }));
  }, [deals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">Funil de Deals por Estágio <InfoTip title="Funil de Deals por Estágio" /></CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={120} className="fill-muted-foreground" />
              <Tooltip />
              <Bar dataKey="deals" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum deal no período</p>
        )}
      </CardContent>
    </Card>
  );
}
