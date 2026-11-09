import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent, type EventRow } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { ProfileCharts } from "@/components/buyers/ProfileCharts";
import { PeopleTable } from "@/components/buyers/PeopleTable";
import { SellerBuyerList } from "@/components/buyers/SellerBuyerList";
import { useAllTimeTicketSales, useFormAnswerCounts } from "@/hooks/useDashboardData";
import { useBuyersData } from "@/hooks/useBuyersData";

const int = (n: number) => n.toLocaleString("pt-BR");

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <Card className="col-span-6 flex flex-col gap-2 p-5 lg:col-span-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        {title} <InfoTip title={title} />
      </div>
      <div className="text-[clamp(26px,2.6vw,34px)] font-semibold leading-none tracking-[-0.035em]">{int(value)}</div>
    </Card>
  );
}

// A equipe de vendas vê só a lista para buscar e abordar; os demais veem a página completa.
export default function Buyers() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerBuyerList /> : <FullBuyers />;
}

// Perfil de quem vem ao evento (todos) e a lista de pessoas com filtros (só administradores).
function FullBuyers() {
  const { isAdmin } = useAuth();
  const { events, event } = useEvent();
  const [aba, setAba] = useState("perfil");
  const perfilTickets = useAllTimeTicketSales(event.sympla_event_id ?? "");
  const perfilRespostas = useFormAnswerCounts(event.sympla_event_id ?? "");

  const { dados, people, companies, eventos } = useBuyersData();

  // Números do evento selecionado; "já vieram" é quem também aparece em algum evento anterior.
  const kpis = useMemo(() => {
    const noEvento = people.filter((p) => p.events[event.slug]);
    const empresas = companies.filter((c) => c.events[event.slug]);
    return {
      pessoas: noEvento.length,
      voltaram: noEvento.filter((p) => Object.keys(p.events).length > 1).length,
      empresas: empresas.length,
      empresasVoltaram: empresas.filter((c) => Object.keys(c.events).length > 1).length,
    };
  }, [people, companies, event.slug]);

  return (
    <div className="space-y-6">
      <PageHeader title="Compradores" description="Quem vem ao evento selecionado, o perfil dessas pessoas e quem já veio em anos anteriores." />

      {isAdmin && (
        <div className="grid grid-cols-12 gap-[14px]">
          {dados.isLoading ? (
            <Skeleton className="col-span-12 h-28" />
          ) : (
            <>
              <Kpi title="Pessoas no evento" value={kpis.pessoas} />
              <Kpi title="Já vieram antes" value={kpis.voltaram} />
              <Kpi title="Empresas no evento" value={kpis.empresas} />
              <Kpi title="Empresas que já vieram" value={kpis.empresasVoltaram} />
            </>
          )}
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        {isAdmin && (
          <SlidingTabsList value={aba} className="mb-4">
            {[
              ["perfil", "Perfil"],
              ["pessoas", "Pessoas"],
            ].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="relative z-[1] data-[state=active]:bg-transparent data-[state=active]:text-background">
                {l}
              </TabsTrigger>
            ))}
          </SlidingTabsList>
        )}

        <TabsContent value="perfil" className="mt-0">
          <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
            {perfilTickets.isLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <ProfileCharts
                tickets={perfilTickets.data ?? []}
                formAnswers={perfilRespostas.data ?? []}
                {...(isAdmin && dados.data ? { people, companies, eventos, eventSlug: event.slug } : {})}
              />
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pessoas" className="mt-0">
            {dados.isLoading ? (
              <Skeleton className="h-96" />
            ) : (
              <PeopleTable people={people} eventos={eventos} eventSlug={event.slug} />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
