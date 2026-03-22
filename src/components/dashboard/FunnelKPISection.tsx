import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { findGoal, type DateRange } from "@/hooks/useDashboardData";

interface FunnelKPISectionProps {
  adMetrics: any[];
  emailCampaigns: any[];
  tickets: any[];
  goals: any[];
  range: DateRange;
}

interface FunnelRow {
  stage: "TOFU" | "MOFU" | "BOFU";
  label: string;
  metricKey: string;
  actual: number;
  format?: "currency" | "number";
  note?: string;
}

const stageBadgeClass: Record<string, string> = {
  TOFU: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MOFU: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  BOFU: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export function FunnelKPISection({ adMetrics, emailCampaigns, tickets, goals, range }: FunnelKPISectionProps) {
  const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);

  const meta = useMemo(() => adMetrics.filter((a) => a.source === "meta"), [adMetrics]);

  const rows: FunnelRow[] = useMemo(() => [
    {
      stage: "TOFU",
      label: "Engajamento",
      metricKey: "funnel_tofu_engagement",
      actual: sum(meta, "post_engagement"),
    },
    {
      stage: "MOFU",
      label: "Carrinho Mídia",
      metricKey: "funnel_mofu_cart",
      actual: sum(meta, "add_to_cart"),
    },
    {
      stage: "MOFU",
      label: "G.D Email",
      metricKey: "funnel_mofu_gd_email",
      actual: sum(emailCampaigns, "total_clicked"),
    },
    {
      stage: "MOFU",
      label: "G.D Mídia",
      metricKey: "funnel_mofu_gd_midia",
      actual: sum(meta, "link_clicks"),
    },
    {
      stage: "BOFU",
      label: "Mensagens",
      metricKey: "funnel_bofu_messages",
      actual: sum(meta, "messages"),
      note: "Meta Ads (sem Leadster)",
    },
    {
      stage: "BOFU",
      label: "Todas Vendas",
      metricKey: "funnel_bofu_sales",
      actual: sum(tickets, "quantity"),
    },
    {
      stage: "BOFU",
      label: "Receita",
      metricKey: "funnel_bofu_revenue",
      actual: sum(tickets, "total_price"),
      format: "currency",
    },
  ], [meta, emailCampaigns, tickets]);

  const formatValue = (value: number, format?: "currency" | "number") => {
    if (format === "currency") return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    return value.toLocaleString("pt-BR");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Funil de KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Etapa</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Objetivo</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Meta</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Realizado</th>
                <th className="text-right py-2 pl-4 font-medium text-muted-foreground w-36">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const goal = findGoal(goals, row.metricKey, range);
                const target = goal?.target_value ?? null;
                const pct = target && target > 0 ? Math.min((row.actual / target) * 100, 100) : null;

                return (
                  <tr key={row.metricKey} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Badge variant="secondary" className={stageBadgeClass[row.stage]}>
                        {row.stage}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-medium">{row.label}</span>
                      {row.note && <span className="text-xs text-muted-foreground ml-2">({row.note})</span>}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {target != null ? formatValue(target, row.format) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                      {formatValue(row.actual, row.format)}
                    </td>
                    <td className="py-3 pl-4">
                      {pct != null ? (
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem meta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
