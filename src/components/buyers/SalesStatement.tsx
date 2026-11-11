import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { utmTexto } from "@/components/dashboard/CommercialSegments";
import { batchCalendar, loteNaData } from "@/lib/batchCalendar";
import { batchOf, lotesParaLista } from "@/lib/batches";
import { couponCodes, couponLabel, canonicalCoupon, parseCoupon } from "@/lib/coupons";
import { canalDe } from "@/lib/salesChannel";
import { saleCode } from "@/lib/salesCategories";
import { VALOR_LIQUIDO_SYMPLA } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ORIGENS = [
  { key: "todas", label: "Todas" },
  { key: "sympla", label: "Sympla" },
  { key: "pipedrive", label: "Faturados" },
] as const;
const TODOS = "__todos";

const linkDe = (t: Ticket) => {
  const partes = [t.utm_source, t.utm_medium, t.utm_campaign, t.utm_content].map(utmTexto);
  return t.source === "pipedrive" || !partes[0] ? "—" : partes.map((p) => p || "—").join(" / ");
};

function Filtro({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-auto min-w-[120px] max-w-[200px] rounded-full bg-card text-xs", value !== TODOS && "border-foreground")}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{label}: todos</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const unicos = (xs: string[]) => [...new Set(xs.filter((x) => x && x !== "—"))].sort((a, b) => a.localeCompare(b, "pt-BR"));

// Extrato: uma linha por venda paga, da mais recente para a mais antiga, com filtros. Fica fechado até alguém abrir.
export function SalesStatement({ tickets }: { tickets: Ticket[] }) {
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState<(typeof ORIGENS)[number]["key"]>("todas");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState(TODOS);
  const [lote, setLote] = useState(TODOS);
  const [pessoa, setPessoa] = useState(TODOS);
  const [canal, setCanal] = useState(TODOS);

  const linhas = useMemo(() => {
    const lotes = batchCalendar();
    return splitTickets(tickets).paying
      .map((t) => {
        const faturado = t.source === "pipedrive";
        const codigoCupom = parseCoupon(t.coupon_code)?.code ?? null;
        const cupom = codigoCupom ? couponLabel(canonicalCoupon(codigoCupom)) : "—";
        const cupomHover = codigoCupom ? couponCodes(canonicalCoupon(codigoCupom)) : "";
        const tipoIngresso = faturado ? "Faturado" : t.ticket_type || "—";
        const descricao = faturado ? t.company || t.deal_title || "Negócio sem nome" : t.ticket_type || "—";
        // Mesmo lote do resto do painel: o do nome do ingresso, já trocado pelo lote da data (faturado pela criação
        // do negócio, ver withBatchByDate). Sem lote no nome, pela data da venda.
        const loteVenda = batchOf(t.ticket_type) ?? (t.sold_at ? loteNaData(String(t.sold_at), lotes) ?? "—" : "—");
        // Sympla: o número do pedido (35EA3…), o mesmo da tela e da busca de participantes da Sympla.
        const codigo = (faturado ? saleCode(t) : t.order_id ?? saleCode(t)) ?? "—";
        const linkNegocio = faturado && t.crm_account && t.deal_id ? `https://${t.crm_account}.pipedrive.com/deal/${t.deal_id}` : null;
        const link = linkDe(t);
        const vendedor = t.seller_name ?? t.seller ?? "—";
        const canalVenda = canalDe(t);
        const texto = [descricao, t.company, (t as any).buyer_name, cupom, codigoCupom, codigo, link, vendedor].filter(Boolean).join(" ").toLowerCase();
        return { t, faturado, cupom, cupomHover, tipoIngresso, descricao, lote: loteVenda, codigo, linkNegocio, link, vendedor, canal: canalVenda, texto };
      })
      .sort((a, b) => String(b.t.sold_at ?? "").localeCompare(String(a.t.sold_at ?? "")));
  }, [tickets]);

  const opcoes = useMemo(() => {
    return {
      tipos: unicos(linhas.map((l) => l.tipoIngresso)),
      lotes: lotesParaLista(unicos(linhas.map((l) => l.lote))),
      pessoas: unicos(linhas.flatMap((l) => [l.cupom, l.vendedor])),
      canais: unicos(linhas.map((l) => l.canal)),
    };
  }, [linhas]);

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(
    (l) =>
      (origem === "todas" || (origem === "pipedrive") === l.faturado) &&
      (tipo === TODOS || l.tipoIngresso === tipo) &&
      (lote === TODOS || l.lote === lote) &&
      (pessoa === TODOS || l.cupom === pessoa || l.vendedor === pessoa) &&
      (canal === TODOS || l.canal === canal) &&
      (!termo || l.texto.includes(termo)),
  );
  const ingressos = visiveis.reduce((s, l) => s + (l.t.quantity ?? 0), 0);
  const receita = visiveis.reduce((s, l) => s + Number(l.t.total_price || 0), 0);
  const temFiltro = origem !== "todas" || tipo !== TODOS || lote !== TODOS || pessoa !== TODOS || canal !== TODOS || !!termo;
  const limpar = () => { setOrigem("todas"); setTipo(TODOS); setLote(TODOS); setPessoa(TODOS); setCanal(TODOS); setBusca(""); };

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <Card className="p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <div>
            <p className="text-sm font-semibold">Extrato de vendas</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {visiveis.length.toLocaleString("pt-BR")} vendas · {ingressos.toLocaleString("pt-BR")} ingressos · {brl(receita)}
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit items-center gap-0.5 rounded-[18px] border bg-secondary p-1">
              {ORIGENS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOrigem(o.key)}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150", origem === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground")}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Filtro label="Tipo" value={tipo} onChange={setTipo} options={opcoes.tipos} />
            <Filtro label="Lote" value={lote} onChange={setLote} options={opcoes.lotes} />
            <Filtro label="Vendedor / cupom" value={pessoa} onChange={setPessoa} options={opcoes.pessoas} />
            <Filtro label="Canal" value={canal} onChange={setCanal} options={opcoes.canais} />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, comprador, pedido ou link" className="h-8 w-full max-w-[280px] rounded-full bg-card text-xs" />
            {temFiltro && (
              <Button variant="ghost" size="sm" onClick={limpar} className="h-8 rounded-full text-xs">
                <X className="mr-1 h-3 w-3" /> Limpar filtros
              </Button>
            )}
          </div>

          <div className="mt-4 max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tipo ou negócio</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Pedido ou negócio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
                ) : visiveis.map((l, i) => (
                  <TableRow key={`${l.codigo}-${i}`}>
                    <TableCell className="whitespace-nowrap tabular-nums">{l.t.sold_at ? format(new Date(l.t.sold_at), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>{l.faturado ? "Faturado" : "Sympla"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.lote}</TableCell>
                    <TableCell className="min-w-[200px]">
                      {l.linkNegocio ? (
                        <a href={l.linkNegocio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-accent-text">
                          {l.descricao} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        l.descricao
                      )}
                      {!l.faturado && l.codigo !== "—" && <div className="text-[11px] tabular-nums text-muted-foreground">Pedido {l.codigo}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.t.quantity ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{brl(Number(l.t.total_price || 0))}</TableCell>
                    <TableCell title={l.cupomHover || undefined}>{l.cupom}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{l.canal}</TableCell>
                    <TableCell className="min-w-[180px] text-xs text-muted-foreground">{l.link}</TableCell>
                    <TableCell>{l.vendedor}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {l.linkNegocio ? (
                        <a href={l.linkNegocio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                          #{l.codigo} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        l.codigo
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Só vendas pagas do período escolhido, sem cortesias nem cancelamentos. O lote segue as datas de Configurações › Lotes. {VALOR_LIQUIDO_SYMPLA}</p>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
