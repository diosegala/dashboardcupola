import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { closerBreakdown, type SaleLine, type SponsorshipMetrics } from "@/lib/sponsorshipMetrics";
import type { FieldStatus } from "@/lib/sponsorshipExtra";
import { CrmWarning } from "./parts";
import { HIDDEN_INFO_KEYS } from "@/lib/sponsorship";
import { cn } from "@/lib/utils";
import { brl } from "./SponsorRevenueCard";

export const SALES_INFO = {
  card: "Uma linha por produto do evento vendido, com link para o negócio no Pipedrive. Corrigido no Pipedrive, o painel atualiza em segundos.",
  data: "Data do ganho do negócio, no fuso de São Paulo.",
  empresa: "Empresa vinculada ao negócio no Pipedrive.",
  produto: "Produto do evento no negócio.",
  cota: "Cota pelo nome do produto. Adicional mostra o item (variação do produto). Sem cota pelo nome, entra em \"Outros produtos do evento\".",
  qtd: "Quantidade do produto no negócio. Duas unidades contam duas cotas.",
  valor: "Valor do produto no negócio, sem centavos.",
  closer: "Responsável do negócio no Pipedrive.",
  filtro: "Mostra só as vendas da cota escolhida. O total e o resumo por closer acompanham o filtro.",
  total: "Soma das linhas mostradas: cotas (quantidade) e valor.",
  porCloser: "Quanto cada closer fechou: negócios, cotas e valor, com a parte de cada um no total. Ainda não há meta por closer.",
  semProduto: "Negócio ganho nesta edição sem nenhum produto do evento. Fica fora da receita até alguém colocar o produto no Pipedrive.",
};

const dia = (d: string) => format(parseISO(d), "dd/MM/yy");

const TODAS = "__todas__";
// Nome da cota da linha, igual ao que a coluna Cota mostra.
const cotaDe = (v: SaleLine) => v.cota ?? (v.adicional ? "Adicional" : "Outros");

function Th({ text, info, className }: { text: string; info: string; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-2 pb-2 text-[11px] font-medium text-muted-foreground first:pl-0", className)}>
      <span className="inline-flex items-center gap-1.5">
        {text}
        <InfoTip title={text} text={info} />
      </span>
    </th>
  );
}

// Coluna que vem de um campo do CRM: só aparece quando o campo existe na conta.
export interface SalesColumn {
  key: string;
  label: string;
  info: string;
  value: (v: SaleLine) => string | null;
}

interface Props {
  metrics: SponsorshipMetrics;
  columns?: SalesColumn[];
  campos?: (FieldStatus | undefined)[];
  // Domínio da conta, para o link do negócio. Sem ele (exemplo), a linha fica sem link.
  account: string | null;
  className?: string;
}

// Lista detalhada das vendas: fica fechada em "Ver detalhes", como pediu a revisão.
export function SponsorSalesCard({ metrics, account, columns = [], campos = [], className }: Props) {
  const [aberto, setAberto] = useState(false);
  const [cotaFiltro, setCotaFiltro] = useState(TODAS);
  const todas = [...metrics.vendas].sort((a, b) => b.ganhoEm.localeCompare(a.ganhoEm) || b.valor - a.valor);
  const cotas = [...new Set(todas.map(cotaDe))];
  // Se a cota escolhida deixou de existir (outro evento, venda corrigida), volta para todas.
  const filtro = cotas.includes(cotaFiltro) ? cotaFiltro : TODAS;
  const vendas = filtro === TODAS ? todas : todas.filter((v) => cotaDe(v) === filtro);
  const totalQtd = vendas.reduce((s, v) => s + v.quantidade, 0);
  const totalValor = vendas.reduce((s, v) => s + v.valor, 0);
  const closers = closerBreakdown(vendas);
  const link = (id: string) => (account ? `https://${account}.pipedrive.com/deal/${id}` : null);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            Vendas <InfoTip title="Vendas" text={SALES_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {vendas.length.toLocaleString("pt-BR")} {vendas.length === 1 ? "produto vendido" : "produtos vendidos"} · {brl(metrics.vendido)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </Button>
      </CardHeader>
      {aberto && (
        <CardContent className="space-y-4">
          <CrmWarning fields={campos.filter((c) => c && c.state !== "ok" && !HIDDEN_INFO_KEYS.includes(c.key))} />
          {vendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda nesta edição ainda.</p>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Select value={filtro} onValueChange={setCotaFiltro}>
                <SelectTrigger className="h-8 w-[200px] rounded-full text-xs" aria-label="Filtrar por cota">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as cotas</SelectItem>
                  {cotas.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InfoTip title="Filtrar por cota" text={SALES_INFO.filtro} />
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr>
                    <Th text="Closer" info={SALES_INFO.porCloser} className="pl-3" />
                    <Th text="Negócios" info="Negócios ganhos com produto do evento." className="text-right" />
                    <Th text="Cotas" info="Quantidade de produtos vendidos." className="text-right" />
                    <Th text="Valor" info={SALES_INFO.valor} className="text-right" />
                    <Th text="% do total" info="Parte do valor vendido (no filtro atual) que o closer fechou." className="pr-3 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {closers.map((c) => (
                    <tr key={c.closer} className="border-t">
                      <td className="py-1.5 pl-3 pr-2 font-medium">{c.closer}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.negocios.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.quantidade.toLocaleString("pt-BR")}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{brl(c.valor)}</td>
                      <td className="py-1.5 pl-2 pr-3 text-right tabular-nums">{Math.round(c.parte * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <Th text="Data" info={SALES_INFO.data} />
                    <Th text="Empresa" info={SALES_INFO.empresa} />
                    <Th text="Produto" info={SALES_INFO.produto} />
                    <Th text="Cota" info={SALES_INFO.cota} />
                    <Th text="Qtd." info={SALES_INFO.qtd} className="text-right" />
                    <Th text="Valor" info={SALES_INFO.valor} className="text-right" />
                    <Th text="Closer" info={SALES_INFO.closer} />
                    {columns.map((c) => (
                      <Th key={c.key} text={c.label} info={c.info} />
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {vendas.map((v, i) => {
                    const href = link(v.pipedriveDealId);
                    return (
                      <tr key={`${v.dealId}-${i}`} className="border-t">
                        <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-muted-foreground">{dia(v.ganhoEm)}</td>
                        <td className="px-2 py-2 font-medium">{v.empresa}</td>
                        <td className="px-2 py-2 text-foreground/80">{v.produto}</td>
                        <td className="px-2 py-2">{v.cota ?? (v.adicional ? `Adicional${v.item ? ` · ${v.item}` : ""}` : <span className="text-muted-foreground">Outros</span>)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{v.quantidade.toLocaleString("pt-BR")}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums">{brl(v.valor)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-foreground/80">{v.closer ?? "—"}</td>
                        {columns.map((c) => {
                          const t = c.value(v);
                          return (
                            <td key={c.key} className="max-w-[180px] truncate px-2 py-2 text-foreground/80" title={t ?? undefined}>
                              {t && /^https?:\/\//.test(t) ? (
                                <a href={t} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                                  {t.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}
                                </a>
                              ) : (
                                t ?? <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pl-2">
                          {href && (
                            <a href={href} target="_blank" rel="noreferrer" title="Abrir o negócio no Pipedrive" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-card">
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 pr-2" colSpan={4}>
                      <span className="inline-flex items-center gap-1.5">
                        Total ({vendas.length.toLocaleString("pt-BR")} {vendas.length === 1 ? "linha" : "linhas"})
                        <InfoTip title="Total" text={SALES_INFO.total} />
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{totalQtd.toLocaleString("pt-BR")}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{brl(totalValor)}</td>
                    <td colSpan={columns.length + 2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
