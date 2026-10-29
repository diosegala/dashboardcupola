import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { useCompare } from "@/hooks/useCompare";
import { batchOf, batchOrder } from "@/lib/batches";
import { fullPrices } from "@/lib/lotPrice";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface SalesSectionProps {
  goals: any[];
  allTimeTickets?: Ticket[];
  previousYearTickets?: Ticket[];
  // Sem o card em volta: usado como aba dentro de "Ingressos emitidos".
  embedded?: boolean;
}

interface Lote {
  lote: string;
  pagantes: number;
  receita: number;
  meta: number | null;
  preco: number | null;
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
export function SalesSection({ goals, allTimeTickets = [], previousYearTickets = [], embedded = false }: SalesSectionProps) {
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
    const { byBatch: precos } = fullPrices(allTimeTickets);
    const lotes: Lote[] = Array.from(nomes)
      .sort((a, b) => batchOrder(a) - batchOrder(b))
      .map((lote) => ({
        lote,
        pagantes: atual.get(lote)?.pagantes ?? 0,
        receita: atual.get(lote)?.receita ?? 0,
        meta: metas.get(lote) ?? null,
        preco: precos.get(lote) ?? null,
        metaReceita: metasReceita.get(lote) ?? null,
        anterior: anterior.get(lote)?.pagantes ?? null,
        anteriorReceita: anterior.get(lote)?.receita ?? null,
      }));
    return { lotes, loteAtual };
  }, [allTimeTickets, previousYearTickets, goals]);

  if (lotes.length === 0) return embedded ? <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma venda por lote ainda.</p> : null;

  const mostrarAnterior = comparar && lotes.some((l) => l.anterior !== null);

  const lista = (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-[13px] tabular-nums">
        <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Lote</th>
            <th className="px-3 py-2 text-right font-medium">Preço</th>
            <th className="px-3 py-2 text-right font-medium">Vendidos</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
            <th className="px-3 py-2 text-left font-medium">% vendido</th>
            <th className="px-3 py-2 text-right font-medium">Receita</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => {
            const vigente = l.lote === loteAtual;
            const pct = l.meta ? l.pagantes / l.meta : null;
            const saldo = l.meta ? Math.max(l.meta - l.pagantes, 0) : null;
            return (
              <tr key={l.lote} className={cn("border-t border-border", vigente && "bg-primary/10")}>
                <td className="px-3 py-2.5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    {l.lote}
                    {vigente && <Chip variant="paid" dot={false} className="px-1.5 py-0 text-[10px]">Vigente</Chip>}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">{l.preco !== null ? brl(l.preco) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {int(l.pagantes)}
                  {mostrarAnterior && l.anterior !== null && <span className="block text-[11px] font-normal text-muted-foreground">{rotulo}: {int(l.anterior)}</span>}
                </td>
                <td className="px-3 py-2.5 text-right">{saldo !== null ? int(saldo) : "—"}</td>
                <td className="px-3 py-2.5">
                  {pct !== null ? (
                    <div className="flex min-w-[90px] items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary">
                        <i className={cn("block h-full rounded-full", vigente ? "bg-primary" : "bg-data-blue")} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
                      </div>
                      <span className="text-xs">{Math.round(pct * 100)}%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {brl(l.receita)}
                  {l.metaReceita ? <span className="block text-[11px] text-muted-foreground">{Math.round((l.receita / l.metaReceita) * 100)}% de {brl(l.metaReceita)}</span> : null}
                  {mostrarAnterior && l.anteriorReceita !== null && <span className="block text-[11px] text-muted-foreground">{rotulo}: {brl(l.anteriorReceita)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  const legenda = (
    <p className="text-xs text-muted-foreground">Saldo e % vendido usam a meta "Ingressos do lote" da aba Metas. Preço: valor mais comum pago sem cupom.</p>
  );

  if (embedded) return <div className="space-y-3 overflow-x-auto">{lista}{legenda}</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Vendas por lote <InfoTip title="Vendas por lote" />
        </CardTitle>
        {legenda}
      </CardHeader>
      <CardContent>{lista}</CardContent>
    </Card>
  );
}
