import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { lotesParaLista } from "@/lib/batches";
import { vendasDoExtrato, agruparComprador, grupoDe, motivoDoStatus, type Venda } from "@/lib/salesStatement";
import { VALOR_LIQUIDO_SYMPLA } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => n.toLocaleString("pt-BR");
const ORIGENS = [
  { key: "todas", label: "Todas" },
  { key: "sympla", label: "Sympla" },
  { key: "faturado", label: "Faturados" },
] as const;
const STATUS = [
  { key: "todos", label: "Todos os status" },
  { key: "aprovadas", label: "Aprovadas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "canceladas", label: "Canceladas" },
] as const;
const TODOS = "__todos";
// Pedido do quadro de visitas: abrir o extrato já filtrado em visita avulsa.
export const ABRIR_EXTRATO_VISITAS = "extrato:visita-avulsa";
export const temVisitaAvulsa = (v: Venda): boolean => v.ingressos.includes("Visita avulsa") || !!v.vendas?.some(temVisitaAvulsa);
const POR_PAGINA = 25;
// Mesmas colunas no cabeçalho e nas linhas: venda, ingressos, (lote a partir de sm) e valor. Ocupa a largura toda.
const GRADE = "grid grid-cols-[minmax(0,1fr)_96px_92px] sm:grid-cols-[minmax(0,1fr)_120px_72px_104px] items-center gap-x-3";

// Etiqueta só para venda com problema: aprovada segue sem nada.
const COR_STATUS: Record<string, string> = {
  Pendente: "bg-warn-bg text-warn",
  "Não pago": "bg-secondary text-muted-foreground",
  Cancelado: "bg-bad-bg text-bad",
  Estornado: "bg-bad-bg text-bad",
};

// Detalhe da venda, aberto ao clicar na linha: o que identifica a venda e de onde ela veio.
function Detalhe({ v }: { v: Venda }) {
  if (v.vendas) return (
    <div className="px-3 pb-3">
      {v.vendas.map((venda) => (
        <div key={venda.chave}>
          <p className="py-2 text-xs font-medium">
            {venda.data ? format(new Date(venda.data), "dd/MM/yyyy") : "—"}
            {" · "}{venda.ingressos}{" · "}{brl(venda.valor)}
          </p>
          <Detalhe v={venda} />
        </div>
      ))}
    </div>
  );
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
    <dl className="grid gap-x-6 gap-y-2 border-t border-dashed px-3 pb-3 pt-2.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {v.status && <p className="text-muted-foreground sm:col-span-2 lg:col-span-3">{motivoDoStatus(v)}</p>}
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
          <dd className="break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// Extrato: pedidos agrupados por comprador, origem, lote e status; totais continuam por venda real.
// Vendas canceladas, estornadas ou aguardando pagamento aparecem com etiqueta e ficam fora dos totais.
export function SalesStatement({ tickets, pedidosSemIngresso = [] }: { tickets: Ticket[]; pedidosSemIngresso?: { order_data: any }[] }) {
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState<(typeof ORIGENS)[number]["key"]>("todas");
  const [lote, setLote] = useState(TODOS);
  const [situacao, setSituacao] = useState<(typeof STATUS)[number]["key"]>("todos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [soVisita, setSoVisita] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abrir = () => {
      setAberto(true); setSoVisita(true); setOrigem("todas"); setLote(TODOS); setSituacao("todos"); setBusca(""); setLimite(POR_PAGINA);
      requestAnimationFrame(() => caixa.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener(ABRIR_EXTRATO_VISITAS, abrir);
    return () => window.removeEventListener(ABRIR_EXTRATO_VISITAS, abrir);
  }, []);

  const vendas = useMemo(() => vendasDoExtrato((({ paying, visits }) => [...paying, ...visits])(splitTickets(tickets)), tickets, pedidosSemIngresso), [tickets, pedidosSemIngresso]);
  const lotes = useMemo(() => lotesParaLista(vendas.map((v) => v.lote).filter((l) => l !== "—")), [vendas]);

  const termo = busca.trim().toLowerCase();
  const visiveis = vendas.filter(
    (v) =>
      (origem === "todas" || (origem === "faturado") === v.faturado) &&
      (lote === TODOS || v.lote === lote) &&
      (situacao === "todos" || grupoDe(v) === situacao) &&
      (!soVisita || temVisitaAvulsa(v)) &&
      (!termo || v.texto.includes(termo)),
  );
  const pagas = visiveis.filter((v) => !v.status);
  const agrupadas = agruparComprador(visiveis);
  const ingressos = pagas.reduce((s, v) => s + v.quantidade, 0);
  const receita = pagas.reduce((s, v) => s + v.valor, 0);
  const aguardando = visiveis.filter((v) => grupoDe(v) === "aguardando");
  const valorAguardando = aguardando.reduce((s, v) => s + v.valor, 0);
  const canceladas = visiveis.filter((v) => grupoDe(v) === "canceladas").length;
  const filtrar = <T,>(set: (x: T) => void) => (x: T) => { set(x); setLimite(POR_PAGINA); setAberta(null); };

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <Card ref={caixa} className="scroll-mt-4 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <div>
            <p className="text-sm font-semibold">Extrato de vendas</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {situacao === "aguardando" ? (
                `${int(aguardando.length)} aguardando pagamento · ${brl(valorAguardando)}`
              ) : situacao === "canceladas" ? (
                `${int(canceladas)} canceladas · não contam na receita`
              ) : (
                <>
                  Pago: {int(pagas.length)} vendas · {int(ingressos)} participantes · {brl(receita)}
                  {situacao === "todos" && aguardando.length > 0 && (
                    <>
                      {" · "}<span className="font-medium text-accent-text">+{int(aguardando.length)} aguardando pagamento ({brl(valorAguardando)})</span>
                      {" · "}Potencial: {brl(receita + valorAguardando)}
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => filtrar(setBusca)(e.target.value)} placeholder="Buscar venda" className="h-9 rounded-full bg-card pl-8 text-xs" />
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-full border bg-secondary p-1">
              {ORIGENS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => filtrar(setOrigem)(o.key)}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150", origem === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Select value={lote} onValueChange={filtrar(setLote)}>
              <SelectTrigger className={cn("h-9 w-[150px] rounded-full bg-card text-xs", lote !== TODOS && "border-foreground")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {lotes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                <SelectItem value={TODOS}>Todos os lotes</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              aria-pressed={soVisita}
              onClick={() => filtrar(setSoVisita)(!soVisita)}
              className={cn("h-9 rounded-full border px-3 text-xs font-semibold transition-colors duration-150", soVisita ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}
            >
              Visita avulsa
            </button>
            <Select value={situacao} onValueChange={(x) => filtrar(setSituacao)(x as typeof situacao)}>
              <SelectTrigger className={cn("h-9 w-[160px] rounded-full bg-card text-xs", situacao !== "todos" && "border-foreground")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border text-[13px] tabular-nums">
            <div className={cn(GRADE, "bg-secondary px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground")}>
              <span>Venda</span>
              <span>Participantes</span>
              <span className="hidden sm:block">Lote</span>
              <span className="text-right">Valor</span>
            </div>
            {visiveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
            ) : (
              agrupadas.slice(0, limite).map((v) => {
                const estaAberta = aberta === v.chave;
                return (
                  <div key={v.chave} className={cn("border-t", estaAberta && "bg-secondary/60")}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setAberta(estaAberta ? null : v.chave)}
                      className={cn(GRADE, "h-auto w-full rounded-none px-3 py-2 text-left text-[13px] font-normal whitespace-normal transition-colors duration-150 hover:bg-secondary/60", v.status && "text-muted-foreground")}
                    >
                      <span className="min-w-0">
                        <span className={cn("block truncate font-medium", !v.status && "text-foreground")} title={v.cliente}>{v.cliente}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", v.faturado ? "bg-primary/25 text-accent-text" : "bg-secondary")}>
                            {v.faturado ? "Faturado" : "Sympla"}
                          </span>
                          {v.status && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn("cursor-help rounded-full px-1.5 text-[10px] font-semibold", COR_STATUS[v.status] ?? "bg-secondary")}>{v.status}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[280px] text-xs leading-snug">{motivoDoStatus(v)}</TooltipContent>
                            </Tooltip>
                          )}
                          {v.data ? format(new Date(v.data), "dd/MM/yyyy") : "—"}
                          {v.vendas && <span>{int(v.vendas.length)} vendas</span>}
                        </span>
                      </span>
                      <span className="min-w-0 break-words text-left" title={v.ingressos}>{v.ingressos}</span>
                      <span className="hidden whitespace-nowrap sm:block">{v.lote}</span>
                      <span className={cn("flex items-center justify-end gap-1.5 whitespace-nowrap", v.status && "line-through decoration-muted-foreground/50")}>
                        {brl(v.valor)}
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", estaAberta && "rotate-180")} />
                      </span>
                    </Button>
                    {estaAberta && <Detalhe v={v} />}
                  </div>
                );
              })
            )}
          </div>
          {agrupadas.length > limite && (
            <Button variant="ghost" size="sm" onClick={() => setLimite((n) => n + POR_PAGINA)} className="mt-2 w-full rounded-full text-xs">
              Ver mais {int(Math.min(POR_PAGINA, agrupadas.length - limite))} de {int(agrupadas.length - limite)} restantes
            </Button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Vendas pagas do período escolhido, sem cortesias. Cancelada, estornada ou aguardando pagamento aparece com etiqueta e não entra nos totais. Aguardando há mais de 7 dias sem aprovar vira cancelado. Clique numa venda para ver pedido, canal, cupom e vendedor. {VALOR_LIQUIDO_SYMPLA}
          </p>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
