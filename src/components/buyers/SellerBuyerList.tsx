import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { PeopleTable } from "@/components/buyers/PeopleTable";
import { buildBuyers, eventRef, type DetailRow } from "@/lib/buyers";

// Lista da equipe de vendas: a mesma da página Compradores, sem contatos.
// Os dados vêm de uma função do banco que entrega só nome, empresa, cupom e situação. E-mail e telefone chegam
// como chaves secretas: servem para achar quem a equipe já conhece (digitando o contato), nunca para mostrar.
export function SellerBuyerList() {
  const { events, event } = useEvent();
  const relevantes = useMemo(() => events.filter((e) => e.slug === event.slug || e.end_date < event.end_date), [events, event]);

  const dados = useQuery({
    queryKey: ["buyers-equipe", event.slug, relevantes.map((e) => e.slug).join("|")],
    enabled: relevantes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () =>
      Promise.all(
        relevantes.map(async (e) => {
          const { data, error } = await supabase.rpc("get_buyer_rows" as any, { p_slug: e.slug });
          return { event: eventRef(e), rows: error ? [] : ((data ?? []) as DetailRow[]) };
        }),
      ),
  });

  const anos = useMemo(() => Array.from(new Set((dados.data ?? []).map((d) => d.event.year))).sort(), [dados.data]);
  const people = useMemo(() => buildBuyers(dados.data ?? []).people, [dados.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description="Comece por quem já veio e ainda não voltou: essas pessoas já conhecem o evento. Para achar alguém que você conhece, busque pelo nome, empresa, e-mail ou telefone."
      />
      {dados.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <PeopleTable people={people} anos={anos} eventSlug={event.slug} eventYear={eventRef(event).year} restrito escopoInicial="fora" />
      )}
    </div>
  );
}
