import { useMemo } from "react";
import { Ticket, DollarSign, TrendingUp, Trophy, Award } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { TicketsByDayChart } from "./charts/TicketsByDayChart";
import { TicketsByTypeChart } from "./charts/TicketsByTypeChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findGoal } from "@/hooks/useDashboardData";

interface SalesSectionProps {
  tickets: any[];
  goals: any[];
  allTimeTickets?: any[];
}

export function SalesSection({ tickets, goals, allTimeTickets = [] }: SalesSectionProps) {
  const totalTickets = useMemo(() => tickets.reduce((s, t) => s + (t.quantity || 0), 0), [tickets]);
  const totalRevenue = useMemo(() => tickets.reduce((s, t) => s + Number(t.total_price || 0), 0), [tickets]);

  const allTimeTotalTickets = useMemo(() => allTimeTickets.reduce((s, t) => s + (t.quantity || 0), 0), [allTimeTickets]);
  const allTimeTotalRevenue = useMemo(() => allTimeTickets.reduce((s, t) => s + Number(t.total_price || 0), 0), [allTimeTickets]);
  const avgTicket = totalTickets > 0 ? totalRevenue / totalTickets : 0;

  const top5Types = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const type = t.ticket_type || "Outros";
      map.set(type, (map.get(type) || 0) + (t.quantity || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [tickets]);

  const ticketsGoal = findGoal(goals, "tickets_sold");
  const revenueGoal = findGoal(goals, "revenue");

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Vendas</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title="Ingressos Vendidos (acumulado)"
          value={allTimeTotalTickets}
          icon={Award}
          description="Total de todos os tempos"
        />
        <MetricCard
          title="Receita Total (acumulado)"
          value={allTimeTotalRevenue}
          icon={Award}
          prefix="R$ "
          description="Total de todos os tempos"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Ingressos Vendidos"
          value={totalTickets}
          icon={Ticket}
          goal={ticketsGoal?.target_value}
        />
        <MetricCard
          title="Receita Total"
          value={totalRevenue}
          icon={DollarSign}
          goal={revenueGoal?.target_value}
          prefix="R$ "
        />
        <MetricCard
          title="Ticket Médio"
          value={avgTicket.toFixed(2)}
          icon={TrendingUp}
          prefix="R$ "
          description="Valor médio por ingresso"
        />
      </div>

      {/* Top 5 tipos de ingresso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Top 5 Tipos de Ingresso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {top5Types.length > 0 ? (
            <div className="space-y-2">
              {top5Types.map(([type, qty], i) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={i === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full flex items-center justify-center text-xs p-0">
                      {i + 1}
                    </Badge>
                    <span className="text-sm">{type}</span>
                  </div>
                  <Badge variant="outline">{qty.toLocaleString("pt-BR")}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado de ingressos no período</p>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TicketsByDayChart tickets={tickets} />
        <TicketsByTypeChart tickets={tickets} />
      </div>

    </section>
  );
}
