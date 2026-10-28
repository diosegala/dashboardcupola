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

  const dados = useQuery({
    queryKey: ["buyers-equipe", event.slug],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Todos os eventos CUPOLA até o selecionado (edições, imersões…), mesmo os que a equipe não abre no painel.
      const lista = await supabase.rpc("get_buyer_events" as any, { p_slug: event.slug });
      const relevantes: { slug: string; name: string; end_date: string }[] =
        !lista.error && (lista.data as any[])?.length
          ? (lista.data as any[])
          : events.filter((e) => e.slug === event.slug || e.end_date < event.end_date);
      return Promise.all(
        relevantes.map(async (e) => {
          const { data, error } = await supabase.rpc("get_buyer_rows" as any, { p_slug: e.slug });
          return { event: eventRef(e), rows: error ? [] : ((data ?? []) as DetailRow[]) };
        }),
      );
    },
  });

  const eventos = useMemo(() => (dados.data ?? []).map((d) => d.event).sort((a, b) => a.endDate.localeCompare(b.endDate)), [dados.data]);
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
        <PeopleTable people={people} eventos={eventos} eventSlug={event.slug} restrito escopoInicial="fora" />
      )}
    </div>
  );
}
