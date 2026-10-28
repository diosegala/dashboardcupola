import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useEvent } from "@/hooks/useEvent";
import { useMyTeamCoupons } from "@/hooks/useTeam";
import { useAllTimeTicketSales } from "@/hooks/useDashboardData";
import { splitTickets } from "@/hooks/useCommercialMetrics";
import { TeamRanking, TeamStanding, buildTeamRanking, findMe } from "@/components/dashboard/TeamRanking";

// Início da equipe de vendas: a própria posição, dicas para subir e o ranking geral do lote.
export function SellerHome() {
  const { profile } = useAuth();
  const { event } = useEvent();
  const vendas = useAllTimeTicketSales(event.sympla_event_id ?? "");
  const meusCupons = useMyTeamCoupons();

  const ranking = useMemo(() => buildTeamRanking(splitTickets(vendas.data ?? []).paying), [vendas.data]);
  const eu = useMemo(() => findMe(ranking, meusCupons.data ?? [], profile?.name), [ranking, meusCupons.data, profile?.name]);
  const primeiroNome = (profile?.name ?? "").trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={primeiroNome ? `Bora vender, ${primeiroNome}` : "Ranking da equipe"}
        description="Sua colocação no lote atual, o que falta para subir e o ranking de toda a equipe. A cada lote o ranking recomeça."
      />
      {vendas.isLoading || meusCupons.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <TeamStanding data={ranking} eu={eu} eventName={event.name} />
          {ranking.lotes.some((l) => l.ranking.length > 0) ? (
            <TeamRanking data={ranking} eu={eu} />
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">Ninguém da equipe vendeu com cupom neste evento ainda.</Card>
          )}
        </>
      )}
    </div>
  );
}
