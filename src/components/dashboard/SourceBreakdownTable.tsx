import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SourceData {
  source: string;
  sessions: number;
  conversions: number;
  avg_engagement_time: number;
  bounce_rate: number;
}

interface SourceBreakdownTableProps {
  title: string;
  data: SourceData[];
  metricKey: keyof Omit<SourceData, "source">;
  formatValue?: (value: number) => string;
}

export function SourceBreakdownTable({
  title,
  data,
  metricKey,
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: SourceBreakdownTableProps) {
  const sorted = [...data].sort((a, b) => b[metricKey] - a[metricKey]).slice(0, 10);
  const chartHeight = Math.max(sorted.length * 40, 80);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="source"
                type="category"
                width={110}
                tick={{ fontSize: 12 }}
                tickFormatter={(v: string) => (v.length > 15 ? v.slice(0, 14) + "…" : v)}
              />
              <Tooltip
                formatter={(value: number) => [formatValue(value), ""]}
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
              />
              <Bar
                dataKey={metricKey as string}
                fill="hsl(var(--data-blue))"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
