import { Fragment, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { lotesParaLista } from "@/lib/batches";
import { agruparVendas, type Venda } from "@/lib/salesStatement";
import { VALOR_LIQUIDO_SYMPLA } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => n.toLocaleString("pt-BR");
const ORIGENS = [
  { key: "todas", label: "Todas" },
  { key: "sympla", label: "Sympla" },
  { key: "faturado", label: "Faturados" },
] as const;
const TODOS = "__todos";

// Detalhe da venda, aberto ao clicar na linha: o que identifica a venda e de onde ela veio.
function Detalhe({ v }: { v: Venda }) {
  const itens: [string, React.ReactNode][] = [
    [
      v.faturado ? "Negócio" : "Pedido na Sympla",
      v.linkNegocio ? (
        <a href={v.linkNegocio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-accent-text">
          #{v.codigo} no Pipedrive <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        v.codigo ?? "—"
      ),
    ],
    ["Ingresso", v.tiposCompletos.join(" · ") || "—"],
    ["Lote", v.lote],
    ["Canal", v.canal],
    ["Cupom", v.cupom ?? "—"],
    ...(v.faturado ? [] : ([["Link de divulgação", v.link ?? "Sem link parametrizado"]] as [string, React.ReactNode][])),
    ["Vendedor", v.vendedor ?? "—"],
    ["Pagamento", v.pagamento ?? "—"],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 px-3 pb-3 pt-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
          <dd className="break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// Extrato: uma linha por venda paga (pedido da Sympla ou negócio faturado), da mais recente para a mais antiga.
// Fica fechado até alguém abrir; o detalhe de cada venda abre ao clicar na linha.
export function SalesStatement({ tickets }: { tickets: Ticket[] }) {
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState<(typeof ORIGENS)[number]["key"]>("todas");
  const [lote, setLote] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const vendas = useMemo(() => agruparVendas(splitTickets(tickets).paying), [tickets]);
  const lotes = useMemo(() => lotesParaLista(vendas.map((v) => v.lote).filter((l) => l !== "—")), [vendas]);

  const termo = busca.trim().toLowerCase();
  const visiveis = vendas.filter(
    (v) =>
      (origem === "todas" || (origem === "faturado") === v.faturado) &&
      (lote === TODOS || v.lote === lote) &&
      (!termo || v.texto.includes(termo)),
  );
  const ingressos = visiveis.reduce((s, v) => s + v.quantidade, 0);
  const receita = visiveis.reduce((s, v) => s + v.valor, 0);

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <Card className="p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <div>
            <p className="text-sm font-semibold">Extrato de vendas</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {int(visiveis.length)} vendas · {int(ingressos)} ingressos · {brl(receita)}
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar venda" className="h-9 rounded-full bg-card pl-8 text-xs" />
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-full border bg-secondary p-1">
              {ORIGENS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOrigem(o.key)}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150", origem === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Select value={lote} onValueChange={setLote}>
              <SelectTrigger className={cn("h-9 w-[150px] rounded-full bg-card text-xs", lote !== TODOS && "border-foreground")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {lotes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                <SelectItem value={TODOS}>Todos os lotes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border">
            <table className="w-full table-fixed text-[13px] tabular-nums">
              <colgroup>
                <col />
                <col className="w-[104px]" />
                <col className="hidden w-[72px] sm:table-column" />
                <col className="w-[100px]" />
              </colgroup>
              <thead className="sticky top-0 z-[1] bg-secondary text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Venda</th>
                  <th className="px-3 py-2 text-left font-medium">Ingressos</th>
                  <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Lote</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</td></tr>
                ) : (
                  visiveis.map((v) => {
                    const estaAberta = aberta === v.chave;
                    return (
                      <Fragment key={v.chave}>
                        <tr
                          onClick={() => setAberta(estaAberta ? null : v.chave)}
                          className={cn("cursor-pointer border-t transition-colors duration-150 hover:bg-secondary/60", estaAberta && "bg-secondary/60")}
                        >
                          <td className="min-w-0 px-3 py-2" title={v.cliente}>
                            <span className="block truncate font-medium">{v.cliente}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", v.faturado ? "bg-primary/25 text-accent-text" : "bg-secondary")}>
                                {v.faturado ? "Faturado" : "Sympla"}
                              </span>
                              {v.data ? format(new Date(v.data), "dd/MM/yyyy") : "—"}
                            </span>
                          </td>
                          <td className="truncate px-3 py-2.5" title={v.ingressos}>{v.ingressos}</td>
                          <td className="hidden whitespace-nowrap px-3 py-2.5 sm:table-cell">{v.lote}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              {brl(v.valor)}
                              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", estaAberta && "rotate-180")} />
                            </span>
                          </td>
                        </tr>
                        {estaAberta && (
                          <tr className="bg-secondary/60">
                            <td colSpan={4}><Detalhe v={v} /></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Só vendas pagas do período escolhido, sem cortesias nem cancelamentos. Clique numa venda para ver pedido, canal, cupom e vendedor. {VALOR_LIQUIDO_SYMPLA}</p>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
