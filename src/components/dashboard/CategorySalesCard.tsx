import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoTip } from "@/components/InfoTip";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { salesByCategory, type CategoryRow } from "@/lib/salesCategories";
import { COLUNAS_CATEGORIA } from "@/lib/metricInfo";

// Texto do mouse: Grupo e Combo mostram a divisão Padrão/VIP; Visita avulsa, as compradas junto com o evento.
function detalhe(l: CategoryRow): string | undefined {
  if (l.categoria === "Grupo" || l.categoria === "Combo") {
    const { padrao, vip } = l.porNivel;
    return `Padrão: ${int(padrao.ingressos)} ingressos · ${brl(padrao.valor)} · VIP: ${int(vip.ingressos)} ingressos · ${brl(vip.valor)}`;
  }
  if (l.categoria === "Visita avulsa" && l.juntoComEvento > 0) return `${int(l.juntoComEvento)} compradas junto com ingresso do evento (mesmo participante)`;
  return undefined;
}

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const TITULO = "Padrão, VIP, combo ou grupo";

// Barra de 100% com a tabela servindo de legenda: uma linha por categoria.
export function CategorySalesCard({ paying, className }: { paying: Ticket[]; className?: string }) {
  const linhas = useMemo(() => salesByCategory(paying), [paying]);
  const [hover, setHover] = useState<string | null>(null);
  const total = linhas.reduce((s, l) => s + l.ingressos, 0);
  if (total === 0) return null;
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {TITULO} <InfoTip title={TITULO} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
          {linhas.map((l, n) => (
            <i key={l.categoria} onMouseEnter={() => setHover(l.categoria)} onMouseLeave={() => setHover(null)} className={cn("block h-full transition-opacity duration-150", hover && hover !== l.categoria && "opacity-35")} style={{ width: `${(l.ingressos / total) * 100}%`, background: CORES[n] }} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Ingressos</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Valor médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, n) => (
                <TableRow key={l.categoria} onMouseEnter={() => setHover(l.categoria)} onMouseLeave={() => setHover(null)} className={cn("transition-opacity duration-150", hover && hover !== l.categoria && "opacity-45")}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CORES[n] }} />
                      {l.categoria}
                    </span>
                    {hover === l.categoria && detalhe(l) && <span className="mt-1 block pl-[18px] text-xs font-normal text-muted-foreground">{detalhe(l)}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{int(l.ingressos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(l.ingressos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(l.pedidos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(l.valor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.media != null ? brl(l.media) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
