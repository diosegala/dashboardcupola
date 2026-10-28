import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { parseCoupon, teamMemberName } from "@/lib/coupons";
import { batchOf, batchOrder } from "@/lib/batches";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

interface Vendedor {
  nome: string;
  cupons: string[];
  vendas: number;
}

// Ranking da equipe CUPOLA: recomeça a cada lote. Só aparece quem vendeu.
export function TeamRanking({ paying }: { paying: Ticket[] }) {
  const { lotes, loteAtual } = useMemo(() => {
    const porLote = new Map<string, Map<string, Vendedor>>();
    let ultimaVenda = "";
    let loteAtual: string | null = null;

    paying.forEach((t) => {
      const lote = batchOf(t.ticket_type);
      if (!lote) return;
      // O lote atual é o da venda mais recente do evento, com ou sem cupom.
      if ((t.sold_at ?? "") >= ultimaVenda) {
        ultimaVenda = t.sold_at ?? "";
        loteAtual = lote;
      }
      const c = parseCoupon(t.coupon_code);
      if (c?.group !== "equipe") return;
      const nome = teamMemberName(c.code);
      const pessoas = porLote.get(lote) ?? new Map<string, Vendedor>();
      const v = pessoas.get(nome) ?? { nome, cupons: [], vendas: 0 };
      if (!v.cupons.includes(c.code)) v.cupons.push(c.code);
      v.vendas += t.quantity || 0;
      pessoas.set(nome, v);
      porLote.set(lote, pessoas);
    });

    if (loteAtual && !porLote.has(loteAtual)) porLote.set(loteAtual, new Map());
    const lotes = Array.from(porLote.entries())
      .map(([lote, pessoas]) => ({
        lote,
        ranking: Array.from(pessoas.values())
          .filter((v) => v.vendas > 0)
          .sort((a, b) => b.vendas - a.vendas || a.nome.localeCompare(b.nome)),
      }))
      .sort((a, b) => batchOrder(a.lote) - batchOrder(b.lote));
    return { lotes, loteAtual: loteAtual as string | null };
  }, [paying]);

  // Campeões: quem liderou cada lote já encerrado (empates contam para todos).
  const campeoes = useMemo(() => {
    const map = new Map<string, { nome: string; cupons: string[]; lotes: string[] }>();
    lotes
      .filter((l) => l.lote !== loteAtual && l.ranking.length > 0)
      .forEach((l) => {
        const topo = l.ranking[0].vendas;
        l.ranking
          .filter((v) => v.vendas === topo)
          .forEach((v) => {
            const c = map.get(v.nome) ?? { nome: v.nome, cupons: [], lotes: [] };
            v.cupons.forEach((code) => !c.cupons.includes(code) && c.cupons.push(code));
            c.lotes.push(l.lote);
            map.set(v.nome, c);
          });
      });
    return Array.from(map.values()).sort((a, b) => b.lotes.length - a.lotes.length || a.nome.localeCompare(b.nome));
  }, [lotes, loteAtual]);

  const indiceAtual = Math.max(lotes.findIndex((l) => l.lote === loteAtual), 0);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const indice = escolhido !== null && escolhido < lotes.length ? escolhido : indiceAtual;
  const lote = lotes[indice];

  if (!lotes.some((l) => l.ranking.length > 0)) return null;

  const max = Math.max(...(lote?.ranking.map((v) => v.vendas) ?? [1]), 1);
  const nomeComCupom = (nome: string, cupons: string[], className?: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default truncate", className)}>{nome}</span>
      </TooltipTrigger>
      <TooltipContent>{cupons.join(", ")}</TooltipContent>
    </Tooltip>
  );

  return (
    <Card className="col-span-12">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Ranking da equipe <InfoTip title="Ranking da equipe" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Lote anterior" disabled={indice <= 0} onClick={() => setEscolhido(indice - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[110px] text-center text-sm font-semibold">{lote?.lote}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Próximo lote" disabled={indice >= lotes.length - 1} onClick={() => setEscolhido(indice + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {lote?.lote === loteAtual && <span className="ml-1 text-xs text-muted-foreground">lote atual</span>}
          </div>

          {lote && lote.ranking.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {lote.ranking.map((v, n) => (
                <li key={v.nome} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2">
                  <span className={cn("text-center text-sm font-semibold tabular-nums", n === 0 ? "text-foreground" : "text-muted-foreground")}>{n + 1}º</span>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                      {nomeComCupom(v.nome, v.cupons, n === 0 ? "font-semibold" : undefined)}
                      <b className="font-semibold tabular-nums">{int(v.vendas)}</b>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <i
                        className={cn(
                          "block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full motion-reduce:animate-none",
                          n === 0 ? "bg-primary" : "bg-data-blue",
                        )}
                        style={{ width: `${(v.vendas / max) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém da equipe vendeu neste lote ainda.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-secondary/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
            <Trophy className="h-4 w-4" /> Quem mais venceu lotes
          </div>
          {campeoes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {campeoes.map((c) => (
                <li key={c.nome} className="flex items-center justify-between gap-3 text-[13px]">
                  {nomeComCupom(c.nome, c.cupons)}
                  <span className="shrink-0 text-muted-foreground" title={c.lotes.join(", ")}>
                    <b className="font-semibold text-foreground tabular-nums">{c.lotes.length}</b> {c.lotes.length === 1 ? "lote" : "lotes"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Aparece quando o primeiro lote com vendas da equipe virar.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
