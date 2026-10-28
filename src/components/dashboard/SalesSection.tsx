import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { findGoal, type DateRange } from "@/hooks/useDashboardData";

interface SalesSectionProps {
  tickets: any[];
  goals: any[];
  allTimeTickets?: any[];
  previousYearTickets?: any[];
  range: DateRange;
  onEditGoal?: (metricKey: string, ticketType?: string | null) => void;
}

export function SalesSection({ tickets, goals, allTimeTickets = [], previousYearTickets = [], range, onEditGoal }: SalesSectionProps) {


  // Per-batch (ticket_type) goals progress
  const batchProgress = useMemo(() => {
    // Get all distinct ticket types in current period
    const typeSet = new Set<string>();
    tickets.forEach((t) => {
      if (t.ticket_type) typeSet.add(t.ticket_type);
    });

    // Also check goals that have ticket_type set for this period
    goals.forEach((g) => {
      if (g.ticket_type && (g.metric_key === "tickets_sold" || g.metric_key === "revenue")) {
        typeSet.add(g.ticket_type);
      }
    });

    const types = Array.from(typeSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return types.map((tt) => {
      const filteredTickets = tickets.filter((t) => t.ticket_type === tt);
      const qty = filteredTickets.reduce((s, t) => s + (t.quantity || 0), 0);
      const rev = filteredTickets.reduce((s, t) => s + Number(t.total_price || 0), 0);

      const qtyGoal = findGoal(goals, "tickets_sold", range, tt);
      const revGoal = findGoal(goals, "revenue", range, tt);

      return {
        type: tt,
        qty,
        rev,
        qtyTarget: qtyGoal ? Number(qtyGoal.target_value) : null,
        revTarget: revGoal ? Number(revGoal.target_value) : null,
      };
    });
  }, [tickets, goals, range]);


  return (
    <section className="space-y-6">
      {/* Per-batch progress table */}
      {batchProgress.length > 0 && batchProgress.some((b) => b.qtyTarget != null || b.revTarget != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Progresso por Lote
              <InfoTip title="Progresso por Lote" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Lote</th>
                    <th className="text-right py-2 px-3 font-medium">Ingressos</th>
                    <th className="text-right py-2 px-3 font-medium">Meta Ing.</th>
                    <th className="py-2 px-3 font-medium min-w-[100px]">%</th>
                    <th className="text-right py-2 px-3 font-medium">Receita</th>
                    <th className="text-right py-2 px-3 font-medium">Meta Rec.</th>
                    <th className="py-2 px-3 font-medium min-w-[100px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {batchProgress.map((b) => {
                    const qtyPct = b.qtyTarget ? Math.min((b.qty / b.qtyTarget) * 100, 100) : null;
                    const revPct = b.revTarget ? Math.min((b.rev / b.revTarget) * 100, 100) : null;
                    return (
                      <tr key={b.type} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{b.type}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{b.qty.toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                          {b.qtyTarget != null ? b.qtyTarget.toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="py-2 px-3">
                          {qtyPct != null ? (
                            <div className="flex items-center gap-2">
                              <Progress value={qtyPct} className="h-2 flex-1" />
                              <span className="text-xs tabular-nums w-10 text-right">{qtyPct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">R$ {b.rev.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                          {b.revTarget != null ? `R$ ${b.revTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="py-2 px-3">
                          {revPct != null ? (
                            <div className="flex items-center gap-2">
                              <Progress value={revPct} className="h-2 flex-1" />
                              <span className="text-xs tabular-nums w-10 text-right">{revPct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}


    </section>
  );
}
