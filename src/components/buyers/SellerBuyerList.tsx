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
import { currentBuyers } from "@/lib/currentBuyers";
import { cn } from "@/lib/utils";

// Lista da equipe: só quem já comprou o evento selecionado (Sympla + faturados). Atualiza sozinha.
const CINCO_MIN = 5 * 60 * 1000;

export function SellerBuyerList() {
  const { event } = useEvent();
  const [filtro, setFiltro] = useState<"todos" | "nominal" | "aguardando">("todos");
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
    const todas = (vendas.data ?? []) as any[];
    const faturados = todas.filter((t) => t.source === "pipedrive");
    const resgatados: Record<string, number> = {};
    todas.forEach((t) => {
      if (t.redeems && String(t.status).toLowerCase() === "approved") resgatados[t.redeems] = (resgatados[t.redeems] ?? 0) + (Number(t.quantity) || 1);
    });
    return currentBuyers(participantes.data ?? [], faturados, resgatados);
  }, [participantes.data, vendas.data]);

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (filtro === "todos" || (filtro === "nominal") === l.nominal) &&
      (!termo || l.nome.toLowerCase().includes(termo) || (l.empresa ?? "").toLowerCase().includes(termo)),
  );
  const soma = (xs: typeof linhas) => xs.reduce((s, l) => s + l.ingressos, 0);
  const nominais = linhas.filter((l) => l.nominal);
  const aguardando = linhas.filter((l) => !l.nominal);
  const ano = eventRef(event).year;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description={`Quem já comprou ${ano}, na Sympla ou em venda faturada. Compras ainda sem os nomes dos participantes aparecem em uma linha só, com a quantidade.`}
      />
      {participantes.isLoading || vendas.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou empresa" className="max-w-md rounded-full" />
            {(
              [
                ["todos", "Todos", soma(linhas)],
                ["nominal", "Com nomes", soma(nominais)],
                ["aguardando", "Aguardando nomes", soma(aguardando)],
              ] as const
            ).map(([v, l, n]) => (
              <button
                key={v}
                onClick={() => setFiltro(v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                  filtro === v ? "bg-foreground text-background" : "bg-card text-foreground/75",
                )}
              >
                {l} <span className="opacity-60">{n} ingressos</span>
              </button>
            ))}
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
                      {l.nominal ? (
                        <span className="tabular-nums">1</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold tabular-nums">{l.ingressos}</span>
                          <span className="whitespace-nowrap rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">aguardando nomes</span>
                        </span>
                      )}
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
