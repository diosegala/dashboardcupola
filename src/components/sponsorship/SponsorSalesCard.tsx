import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import type { SaleLine, SponsorshipMetrics } from "@/lib/sponsorshipMetrics";
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
  semProduto: "Negócio ganho nesta edição sem nenhum produto do evento. Fica fora da receita até alguém colocar o produto no Pipedrive.",
};

const dia = (d: string) => format(parseISO(d), "dd/MM/yy");

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
  const vendas = [...metrics.vendas].sort((a, b) => b.ganhoEm.localeCompare(a.ganhoEm) || b.valor - a.valor);
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
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
