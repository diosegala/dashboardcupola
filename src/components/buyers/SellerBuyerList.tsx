import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildBuyers, eventRef, matchNextEvent, titleCase, type DetailRow } from "@/lib/buyers";
import { cn } from "@/lib/utils";

// Lista da equipe: quem participou do evento anterior e se já comprou o evento selecionado.
// Só nome, empresa e cupom. Compra é reconhecida pelo nome da pessoa (90% igual ou mais), na Sympla ou faturada.
const limpaCupom = (c: string | null) => (c ? c.replace(/^\s*[\d.,]+%\s*-\s*/, "").trim() : null);

export function SellerBuyerList() {
  const { event, events } = useEvent();
  const anterior = useMemo(
    () => [...events].filter((e) => e.end_date < event.end_date).sort((a, b) => b.end_date.localeCompare(a.end_date))[0],
    [events, event],
  );
  const [filtro, setFiltro] = useState<"todos" | "sim" | "nao">("todos");
  const [busca, setBusca] = useState("");

  const dados = useQuery({
    queryKey: ["equipe-recompra", event.slug, anterior?.slug],
    enabled: !!anterior,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const ler = async (slug: string) => {
        const { data, error } = await supabase.rpc("get_buyer_rows" as any, { p_slug: slug });
        return error ? [] : ((data ?? []) as DetailRow[]);
      };
      const [antes, agora] = await Promise.all([ler(anterior!.slug), ler(event.slug)]);
      // Vendas internas ganhas depois do fim do evento anterior: entram pelo nome da pessoa, sem cupom.
      const { data: deals } = await supabase
        .from("deals")
        .select("person_name")
        .eq("status", "won")
        .eq("is_deleted", false)
        .gt("won_at", `${anterior!.end_date}T23:59:59`)
        .lte("won_at", `${event.end_date}T23:59:59`);
      return { antes, agora, faturados: (deals ?? []).map((d: any) => d.person_name).filter(Boolean) as string[] };
    },
  });

  const linhas = useMemo(() => {
    if (!dados.data || !anterior) return [];
    const evA = eventRef(anterior);
    const evB = eventRef(event);
    const passados = buildBuyers([{ event: evA, rows: dados.data.antes }]).people;
    const atuais = buildBuyers([{ event: evB, rows: dados.data.agora }]).people;
    const compras = [
      ...atuais.map((p) => ({ name: p.name, coupon: limpaCupom([...(p.events[evB.slug]?.coupons ?? [])][0] ?? null) })),
      ...dados.data.faturados.map((n) => ({ name: n, coupon: null })),
    ];
    return passados
      .filter((p) => p.events[evA.slug]?.roles.has("participante"))
      .map((p) => {
        const m = matchNextEvent(p.name, compras);
        return {
          id: p.id,
          nome: p.name,
          empresa: p.companies[0] ?? null,
          cupomAntes: limpaCupom([...(p.events[evA.slug]?.coupons ?? [])][0] ?? null),
          ...m,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [dados.data, anterior, event]);

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (filtro === "todos" || (filtro === "sim") === l.comprou) &&
      (!termo || l.nome.toLowerCase().includes(termo) || (l.empresa ?? "").toLowerCase().includes(termo)),
  );
  const ja = linhas.filter((l) => l.comprou).length;
  const anoA = anterior ? eventRef(anterior).year : "";
  const anoB = eventRef(event).year;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description={
          anterior
            ? `Quem participou de ${anoA} e se já comprou ${anoB}. A compra é reconhecida automaticamente pelo nome da pessoa, na Sympla ou em venda interna.`
            : "Não há evento anterior para comparar."
        }
      />
      {!anterior ? null : dados.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou empresa" className="max-w-md rounded-full" />
            {(
              [
                ["todos", "Todos", linhas.length],
                ["sim", `Já compraram ${anoB}`, ja],
                ["nao", "Ainda não compraram", linhas.length - ja],
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
                {l} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 font-medium">Comprou {anoB}</th>
                  <th className="px-5 py-3 font-medium">Cupom</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{l.nome}</td>
                    <td className="max-w-[260px] truncate px-5 py-3 text-muted-foreground">{l.empresa ? titleCase(l.empresa) : "—"}</td>
                    <td className="px-5 py-3">
                      {l.comprou ? (
                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Sim</span>
                      ) : (
                        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Ainda não</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      {l.cupomAntes || l.coupon ? (
                        <div className="space-y-0.5">
                          {l.coupon && <div>{anoB}: {l.coupon}</div>}
                          {l.cupomAntes && <div className="text-muted-foreground">{anoA}: {l.cupomAntes}</div>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">Ninguém encontrado.</td>
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
