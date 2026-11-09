import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { useCompare } from "@/hooks/useCompare";
import { resumoLotes } from "@/lib/batchSummary";
import { LoteSelos, dataCurta } from "./BatchStatus";
import { cn } from "@/lib/utils";

// Na aba Por lote, 3 lotes por página para a lista não crescer demais.
const POR_PAGINA = 3;

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface SalesSectionProps {
  goals: any[];
  allTimeTickets?: Ticket[];
  previousYearTickets?: Ticket[];
  // Sem o card em volta: usado como aba "Por lote" dentro de "Lote vigente".
  embedded?: boolean;
}

// Vendas por lote: cada lote deste ano com a meta do lote (se houver) e o mesmo lote do evento anterior (com a chave ligada).
export function SalesSection({ goals, allTimeTickets = [], previousYearTickets = [], embedded = false }: SalesSectionProps) {
  const { ativo: comparar, rotulo } = useCompare();

  const { lotes, loteAtual } = useMemo(() => resumoLotes(goals, allTimeTickets, previousYearTickets), [allTimeTickets, previousYearTickets, goals]);
  // Abre na página do lote vigente (a lista vem do mais novo para o mais antigo).
  const posVigente = [...lotes].reverse().findIndex((l) => l.lote === loteAtual);
  const [paginaEscolhida, setPagina] = useState<number | null>(null);
  const pagina = paginaEscolhida ?? Math.max(0, Math.floor(posVigente / POR_PAGINA));

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
            {mostrarAnterior && <th className="px-3 py-2 text-right font-medium" title={`Quanto o mesmo lote vendeu no evento de ${rotulo}`}>Em {rotulo}</th>}
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
                    <LoteSelos lote={l} pequeno />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">{l.preco !== null ? brl(l.preco) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{int(l.pagantes)}</td>
                {mostrarAnterior && <td className="px-3 py-2.5 text-right text-muted-foreground">{l.anterior !== null ? int(l.anterior) : "—"}</td>}
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
                  {mostrarAnterior && l.anteriorReceita !== null && <span className="block text-[11px] text-muted-foreground" title={`Receita do mesmo lote no evento de ${rotulo}`}>{rotulo}: {brl(l.anteriorReceita)}</span>}
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

  // Dentro de um card estreito, cada lote vira um bloco: os números quebram linha em vez de vazar ou cortar.
  if (embedded) {
    const totalPaginas = Math.max(1, Math.ceil(lotes.length / POR_PAGINA));
    const atual = Math.min(pagina, totalPaginas - 1);
    // O lote mais novo sempre no topo.
    const visiveis = [...lotes].reverse().slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
    return (
      <div className="space-y-3">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {visiveis.map((l) => {
            const vigente = l.lote === loteAtual;
            const pct = l.meta ? l.pagantes / l.meta : null;
            const saldo = l.meta ? Math.max(l.meta - l.pagantes, 0) : null;
            return (
              <li key={l.lote} className={cn("space-y-1.5 px-3 py-2.5 text-[13px] tabular-nums", vigente && "bg-primary/10")}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                    <span className="break-words">{l.lote}</span>
                    <LoteSelos lote={l} pequeno />
                  </span>
                  <span className="whitespace-nowrap">
                    <b className="font-semibold">{int(l.pagantes)}</b>
                    <span className="text-muted-foreground">{l.meta ? ` de ${int(l.meta)}` : " vendidos"}</span>
                  </span>
                </div>
                {pct !== null && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-secondary">
                      <i className={cn("block h-full rounded-full", vigente ? "bg-primary" : "bg-data-blue")} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs">{Math.round(pct * 100)}%</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Preço <b className="font-medium text-foreground">{l.preco !== null ? brl(l.preco) : "—"}</b></span>
                  {saldo !== null && <span>Saldo <b className="font-medium text-foreground">{int(saldo)}</b></span>}
                  <span>
                    Receita <b className="font-medium text-foreground">{brl(l.receita)}</b>
                    {l.metaReceita ? ` (${Math.round((l.receita / l.metaReceita) * 100)}% de ${brl(l.metaReceita)})` : ""}
                  </span>
                  {l.inicio && l.fim && <span>{dataCurta(l.inicio)} a {dataCurta(l.fim)}</span>}
                  {mostrarAnterior && l.anterior !== null && (
                    <span>
                      {rotulo} <b className="font-medium text-foreground">{int(l.anterior)}</b>
                      {l.anteriorReceita !== null ? ` · ${brl(l.anteriorReceita)}` : ""}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Página {atual + 1} de {totalPaginas} · {lotes.length} lotes
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Lotes mais novos" disabled={atual === 0} onClick={() => setPagina(atual - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Lotes mais antigos" disabled={atual >= totalPaginas - 1} onClick={() => setPagina(atual + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
        {legenda}
      </div>
    );
  }

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
