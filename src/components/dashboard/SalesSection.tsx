import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { useCompare } from "@/hooks/useCompare";
import { batchOf, batchOrder } from "@/lib/batches";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface SalesSectionProps {
  goals: any[];
  allTimeTickets?: Ticket[];
  previousYearTickets?: Ticket[];
}

interface Lote {
  lote: string;
  pagantes: number;
  receita: number;
  meta: number | null;
  metaReceita: number | null;
  anterior: number | null;
  anteriorReceita: number | null;
}

// Soma pagantes e receita por lote (pré-venda, lote 1, lote 2…), juntando os nomes que mudam a cada ano.
function porLote(tickets: Ticket[]) {
  const map = new Map<string, { pagantes: number; receita: number; ultimaVenda: string }>();
  splitTickets(tickets).paying.forEach((t) => {
    const lote = batchOf(t.ticket_type);
    if (!lote) return;
    const atual = map.get(lote) ?? { pagantes: 0, receita: 0, ultimaVenda: "" };
    atual.pagantes += t.quantity || 0;
    atual.receita += Number(t.total_price || 0);
    if ((t.sold_at ?? "") > atual.ultimaVenda) atual.ultimaVenda = t.sold_at ?? "";
    map.set(lote, atual);
  });
  return map;
}

// Vendas por lote: cada lote deste ano com a meta do lote (se houver) e o mesmo lote do evento anterior (com a chave ligada).
export function SalesSection({ goals, allTimeTickets = [], previousYearTickets = [] }: SalesSectionProps) {
  const { ativo: comparar, rotulo } = useCompare();

  const { lotes, loteAtual } = useMemo(() => {
    const atual = porLote(allTimeTickets);
    const anterior = porLote(previousYearTickets);
    // Metas por lote: a meta de ingressos do lote (tela Metas), somando os nomes que caem no mesmo lote.
    const somaMetas = (chave: string) => {
      const m = new Map<string, number>();
      goals
        .filter((g) => g.metric_key === chave && g.ticket_type)
        .forEach((g) => {
          const lote = batchOf(g.ticket_type);
          if (lote) m.set(lote, (m.get(lote) ?? 0) + Number(g.target_value || 0));
        });
      return m;
    };
    const metas = somaMetas("tickets_sold");
    const metasReceita = somaMetas("revenue");
    const nomes = new Set([...atual.keys(), ...metas.keys(), ...metasReceita.keys()]);
    const loteAtual = Array.from(atual.entries()).sort((a, b) => b[1].ultimaVenda.localeCompare(a[1].ultimaVenda))[0]?.[0] ?? null;
    const lotes: Lote[] = Array.from(nomes)
      .sort((a, b) => batchOrder(a) - batchOrder(b))
      .map((lote) => ({
        lote,
        pagantes: atual.get(lote)?.pagantes ?? 0,
        receita: atual.get(lote)?.receita ?? 0,
        meta: metas.get(lote) ?? null,
        metaReceita: metasReceita.get(lote) ?? null,
        anterior: anterior.get(lote)?.pagantes ?? null,
        anteriorReceita: anterior.get(lote)?.receita ?? null,
      }));
    return { lotes, loteAtual };
  }, [allTimeTickets, previousYearTickets, goals]);

  if (lotes.length === 0) return null;

  const mostrarAnterior = comparar && lotes.some((l) => l.anterior !== null);
  const max = Math.max(...lotes.flatMap((l) => [l.pagantes, l.meta ?? 0, mostrarAnterior ? l.anterior ?? 0 : 0]), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Vendas por lote <InfoTip title="Vendas por lote" />
        </CardTitle>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-3 rounded-full bg-data-blue" /> Pagantes</span>
          {lotes.some((l) => l.meta) && <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-[2px] rounded-full bg-foreground/45" /> Meta do lote</span>}
          {mostrarAnterior && <span className="flex items-center gap-1.5"><i className="inline-block w-3 border-t-[1.5px] border-dashed border-muted-foreground" /> {rotulo} no mesmo lote</span>}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3.5">
          {lotes.map((l) => {
            const pctMeta = l.meta ? Math.round((l.pagantes / l.meta) * 100) : null;
            return (
              <li key={l.lote} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  {l.lote}
                  {l.lote === loteAtual && <Chip variant="paid" dot={false} className="px-1.5 py-0 text-[10px]">atual</Chip>}
                </span>
                <div className="space-y-1">
                  <div className="relative h-2.5 rounded-full bg-secondary">
                    <i
                      className={cn("block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full motion-reduce:animate-none", l.lote === loteAtual ? "bg-primary" : "bg-data-blue")}
                      style={{ width: `${(l.pagantes / max) * 100}%` }}
                    />
                    {l.meta && (
                      <span className="absolute -top-[3px] h-4 w-[2px] rounded-full bg-foreground/45" style={{ left: `calc(${(l.meta / max) * 100}% - 1px)` }} title={`Meta do lote: ${int(l.meta)}`} />
                    )}
                  </div>
                  {mostrarAnterior && l.anterior !== null && (
                    <div className="h-0 border-t-[1.5px] border-dashed border-muted-foreground/70" style={{ width: `${(l.anterior / max) * 100}%` }} title={`${rotulo}: ${int(l.anterior)} pagantes`} />
                  )}
                </div>
                <span className="min-w-[150px] text-right text-xs leading-tight">
                  <b className="text-[13px] font-semibold tabular-nums">{int(l.pagantes)}</b>
                  <span className="text-muted-foreground"> pagantes · {brl(l.receita)}</span>
                  {pctMeta !== null && <span className="block text-muted-foreground">{pctMeta}% da meta de {int(l.meta as number)}</span>}
                  {l.metaReceita ? <span className="block text-muted-foreground">{Math.round((l.receita / l.metaReceita) * 100)}% da meta de {brl(l.metaReceita)}</span> : null}
                  {mostrarAnterior && l.anterior !== null && (
                    <span className="block text-muted-foreground">
                      {rotulo}: {int(l.anterior)} · {brl(l.anteriorReceita ?? 0)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
