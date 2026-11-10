import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/hooks/useEvent";
import { useAllTimeTicketSales } from "@/hooks/useDashboardData";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { eventRef, type DetailRow } from "@/lib/buyers";
import { currentBuyers, faturadosDasVendas } from "@/lib/currentBuyers";

// Lista da equipe: só quem já comprou o evento selecionado (Sympla + faturados). Atualiza sozinha.
const CINCO_MIN = 5 * 60 * 1000;

export function SellerBuyerList() {
  const { event } = useEvent();
  const [busca, setBusca] = useState("");

  const participantes = useQuery({
    queryKey: ["equipe-compradores", event.slug],
    staleTime: 60 * 1000,
    refetchInterval: CINCO_MIN,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_buyer_rows" as any, { p_slug: event.slug });
      if (error) throw error;
      return (data ?? []) as DetailRow[];
    },
  });
  const vendas = useAllTimeTicketSales(event.sympla_event_id ?? "");

  const linhas = useMemo(() => {
    // Faturado: na coluna Cupom aparece quem vendeu (nome cadastrado em Cupons, ex. "Leticia B", ou o primeiro nome).
    const { faturados, resgatados } = faturadosDasVendas((vendas.data ?? []) as any[]);
    return currentBuyers(participantes.data ?? [], faturados, resgatados);
  }, [participantes.data, vendas.data]);

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) => !termo || l.nome.toLowerCase().includes(termo) || (l.empresa ?? "").toLowerCase().includes(termo) || (l.cupom ?? "").toLowerCase().includes(termo),
  );
  const soma = (xs: typeof linhas) => xs.reduce((s, l) => s + l.ingressos, 0);
  const ano = eventRef(event).year;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description={`Quem já comprou ${ano}, na Sympla ou em venda faturada. Nas vendas faturadas, a coluna Cupom mostra quem vendeu.`}
      />
      {participantes.isLoading || vendas.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou empresa" className="max-w-md rounded-full" />
            <span className="text-[13px] font-semibold text-foreground/75">{soma(linhas)} ingressos</span>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 text-right font-medium">Ingressos</th>
                  <th className="px-5 py-3 font-medium">Origem</th>
                  <th className="px-5 py-3 font-medium">Cupom</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{l.nome}</td>
                    <td className="max-w-[260px] truncate px-5 py-3 text-muted-foreground">{l.empresa ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="tabular-nums">{l.ingressos}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{l.origem}</td>
                    <td className="px-5 py-3 font-mono text-xs">{l.cupom ?? "—"}</td>
                  </tr>
                ))}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Ninguém encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
