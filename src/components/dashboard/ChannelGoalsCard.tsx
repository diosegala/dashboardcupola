import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf, lotesParaLista } from "@/lib/batches";
import { resumoLotes } from "@/lib/batchSummary";
import { AvisoDatas } from "./BatchStatus";
import { CANAIS, SEM_CANAL, metaDoCanal, vendasPorCanal } from "@/lib/salesChannel";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const EVENTO = "__evento";

export const REGRAS_CANAL =
  "Como cada venda ganha um canal: 1) faturado interno conta para a Equipe CUPOLA, ou para BDR quando a vendedora é a Letícia Bello; " +
  "2) na Sympla, o link parametrizado (UTMs) decide, mesmo quando a compra usou cupom; todo link com \"bdr\" é BDR; " +
  "3) sem link, ou com link que não identifica o canal, o cupom decide: cupons da Letícia Bello (exceto LETICIAA5) são BDR, cupons com o nome de uma empresa que fechou patrocínio são Patrocinadores e os cupons nominais da equipe são Equipe CUPOLA; " +
  "4) o resto fica em Sem canal identificado, fora das metas. Vendas canceladas não contam.";

interface Props {
  // Vendas do período escolhido no topo.
  tickets: Ticket[];
  // Todas as vendas do evento, para achar os lotes e o vigente.
  allTickets: Ticket[];
  goals: any[];
}

export function ChannelGoalsCard({ tickets, allTickets, goals }: Props) {
  const { loteAtual, lotes: resumo, faltamDatas } = useMemo(() => resumoLotes(goals, allTickets, []), [goals, allTickets]);
  const lotes = useMemo(() => {
    const s = new Set<string>();
    allTickets.forEach((t) => { const b = batchOf(t.ticket_type); if (b) s.add(b); });
    resumo.forEach((l) => s.add(l.lote));
    return lotesParaLista(Array.from(s), loteAtual);
  }, [allTickets, goals, resumo, loteAtual]);
  const [escolha, setEscolha] = useState<string | null>(null);
  const recorte = escolha ?? loteAtual ?? EVENTO;
  const lote = recorte === EVENTO ? null : recorte;

  const linhas = useMemo(() => {
    const doLote = lote ? tickets.filter((t) => batchOf(t.ticket_type) === lote) : tickets;
    return vendasPorCanal(splitTickets(doLote).paying).map((c) => {
      const meta = c.label === SEM_CANAL ? null : metaDoCanal(goals, c.label, lote, batchOf);
      const pct = meta ? (c.value / meta) * 100 : null;
      return { ...c, meta, pct, falta: meta != null ? Math.max(0, meta - c.value) : null };
    });
  }, [tickets, goals, lote]);
  const comMeta = linhas.filter((l) => l.meta != null);
  const bateram = comMeta.filter((l) => l.value >= (l.meta ?? 0)).length;
  const total = linhas.reduce((s, l) => s + l.value, 0);
  const maior = Math.max(1, ...linhas.map((l) => Math.max(l.value, l.meta ?? 0)));

  return (
    <Card className="col-span-12">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">Vendas por canal <InfoTip title="Vendas por canal" /></CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {int(total)} pagantes{comMeta.length ? ` · ${bateram} de ${comMeta.length} canais com meta bateram` : " · nenhuma meta de canal neste recorte"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={recorte} onValueChange={setEscolha}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {lotes.map((l) => <SelectItem key={l} value={l}>{l}{l === loteAtual ? " (vigente)" : ""}</SelectItem>)}
              <SelectItem value={EVENTO}>Evento todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {faltamDatas && <div className="mb-4"><AvisoDatas compacto /></div>}
        <Tabs defaultValue="canais">
          <TabsList className="mb-4">
            <TabsTrigger value="canais">Por canal</TabsTrigger>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="canais" className="space-y-4">
            {linhas.map((l) => (
              <div key={l.label} className={l.label === SEM_CANAL ? "border-t border-border pt-4" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {l.label}
                    {l.meta != null && l.value >= l.meta && <Chip variant="ok">Bateu</Chip>}
                  </span>
                  <span className="text-muted-foreground">
                    <b className="text-foreground">{int(l.value)}</b>
                    {l.meta != null && <> de {int(l.meta)} · {Math.round(l.pct ?? 0)}% · {l.falta ? `faltam ${int(l.falta)}` : "meta batida"}</>}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(l.value / (l.meta ?? maior)) * 100 > 100 ? 100 : (l.value / (l.meta ?? maior)) * 100}%` }} />
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="tabela">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium">Canal</th>
                    <th className="py-2 text-right font-medium">Vendidos</th>
                    <th className="py-2 text-right font-medium">Meta</th>
                    <th className="py-2 text-right font-medium">%</th>
                    <th className="py-2 text-right font-medium">Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.label} className="border-b border-border/60">
                      <td className="py-2">{l.label}</td>
                      <td className="py-2 text-right tabular-nums">{int(l.value)}</td>
                      <td className="py-2 text-right tabular-nums">{l.meta != null ? int(l.meta) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{l.pct != null ? `${Math.round(l.pct)}%` : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{l.falta != null ? int(l.falta) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{int(total)}</td>
                    <td className="py-2 text-right tabular-nums">{comMeta.length ? int(comMeta.reduce((s, l) => s + (l.meta ?? 0), 0)) : "—"}</td>
                    <td /><td />
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
        <p className="mt-4 text-xs text-muted-foreground">{REGRAS_CANAL} Metas por canal e lote ficam em Metas › Canais de venda; em Evento todo, as metas dos lotes somam.</p>
      </CardContent>
    </Card>
  );
}

export { CANAIS };
