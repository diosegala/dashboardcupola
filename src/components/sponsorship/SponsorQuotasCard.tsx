import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardTabs } from "./CardTabs";
import { InfoTip } from "@/components/InfoTip";
import { CompareLine } from "@/components/CompareLine";
import { ADDONS_KEY, quotaTargets, type QuotaRow } from "@/lib/sponsorshipMetrics";
import { brl } from "./SponsorRevenueCard";

export const QUOTAS_INFO = {
  card: "Quantidade do produto da cota em negócios ganhos. Um negócio com 2 unidades conta 2 cotas. Os nomes vêm dos produtos do Pipedrive.",
  porCota:
    "A barra verde mostra só as cotas vendidas. As negociações em andamento aparecem no texto abaixo de cada linha. Todas as linhas usam a mesma escala. Com meta cadastrada (menu Metas), a linha vai até a meta da cota.",
  receita: "Quanto cada cota já vendeu, em reais. Com meta de cotas cadastrada, mostra quantas faltam para a meta.",
  metaFalta:
    "Para cada cota: meta (menu Metas), cotas vendidas, % da meta e quantas faltam. O total soma só as cotas que têm meta. Cota sem meta aparece com traço. Em negociação são cotas em negócios abertos, que ainda não contam como vendidas.",
  semNada: "Cotas do evento no Pipedrive que ainda não têm nenhuma venda nem negócio aberto nesta edição.",
  semVenda: "Cotas do evento no Pipedrive que ainda não venderam nada nesta edição.",
};

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function SponsorQuotasCard({
  rows,
  cotasAnterior = null,
  className,
  selectedKey = null,
  onSelect,
}: {
  rows: QuotaRow[];
  cotasAnterior?: number | null;
  className?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  const [aba, setAba] = useState<"cota" | "meta" | "receita">("cota");
  const alvo = quotaTargets(rows);
  const ehCota = (r: QuotaRow) => r.key !== "" && r.key !== ADDONS_KEY;
  const cotas = rows.filter(ehCota);
  const vendidas = cotas.reduce((s, r) => s + r.vendidas, 0);
  const negociando = cotas.reduce((s, r) => s + r.emNegociacao, 0);
  const meta = cotas.reduce((s, r) => s + (r.meta ?? 0), 0);

  const comMovimento = rows.filter((r) => r.vendidas > 0 || r.emNegociacao > 0 || (r.meta ?? 0) > 0);
  const semNada = cotas.filter((r) => !comMovimento.includes(r));
  const escala = Math.max(...comMovimento.map((r) => Math.max(r.meta ?? 0, r.vendidas + r.emNegociacao)), 1);

  const comVenda = rows.filter((r) => r.vendidas > 0);
  const semVenda = cotas.filter((r) => r.vendidas === 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Cotas vendidas <InfoTip title="Cotas vendidas" text={QUOTAS_INFO.card} />
          </CardTitle>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="text-[clamp(32px,3.4vw,42px)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                {int(vendidas)}
                {meta > 0 && <small className="ml-1.5 text-sm font-medium tracking-normal text-muted-foreground">de {int(meta)}</small>}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <i className="h-2 w-2 rounded-full bg-primary" /> {vendidas === 1 ? "vendida" : "vendidas"}
              </div>
            </div>
            <div>
              <div className="text-[clamp(32px,3.4vw,42px)] font-semibold leading-none tracking-[-0.035em] tabular-nums">{int(negociando)}</div>
              <div className="mt-1.5 whitespace-nowrap text-xs text-muted-foreground">em negociação</div>
            </div>
          </div>
          <CompareLine className="mt-2" anterior={cotasAnterior} atual={vendidas} />
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "cota", label: "Por cota", info: QUOTAS_INFO.porCota },
            { value: "meta", label: "Meta e falta", info: QUOTAS_INFO.metaFalta },
            { value: "receita", label: "Receita por cota", info: QUOTAS_INFO.receita },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {aba === "meta" ? (
          alvo.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cota com meta, venda ou negociação ainda.</p>
          ) : (
            <div>
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[52px]" />
                  <col className="w-[64px]" />
                  <col className="w-[44px]" />
                  <col className="w-[60px]" />
                </colgroup>
                <thead>
                  <tr className="text-[11px] font-medium text-muted-foreground">
                    <th className="pb-2 pr-1.5 font-medium">Cota</th>
                    <th className="px-1.5 pb-2 text-right font-medium">Meta</th>
                    <th className="px-1.5 pb-2 text-right font-medium">Vendidas</th>
                    <th className="px-1.5 pb-2 text-right font-medium">%</th>
                    <th className="pl-1.5 pb-2 text-right font-medium">Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {[...alvo.rows, ...(alvo.total ? [alvo.total] : [])].map((r) => {
                    const total = r.key === "__total__";
                    return (
                      <tr key={r.key} className={total ? "border-t-2 font-semibold" : "border-t"}>
                        <td className="break-words py-2 pr-1.5">
                          {r.nome}
                          {r.emNegociacao > 0 && !total && <span className="block text-[10px] font-normal text-muted-foreground">+{int(r.emNegociacao)} em negociação</span>}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-right tabular-nums">{r.meta != null ? int(r.meta) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-right tabular-nums">{int(r.vendidas)}</td>
                        <td className="whitespace-nowrap px-1.5 py-2 text-right tabular-nums">{r.pct != null ? `${Math.round(r.pct * 100)}%` : <span className="text-muted-foreground">—</span>}</td>
                        <td className="whitespace-nowrap pl-1.5 py-2 text-right tabular-nums">
                          {r.falta == null ? <span className="text-muted-foreground">—</span> : r.falta === 0 ? <span className="font-semibold text-ok">Atingida</span> : int(r.falta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : aba === "cota" ? (
          comMovimento.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cota vendida nem em negociação ainda.</p>
          ) : (
            <div className="space-y-2">
              {comMovimento.map((r) => (
                <button
                  type="button"
                  key={r.key || "outros"}
                  onClick={() => onSelect?.(r.key)}
                  aria-pressed={selectedKey === r.key}
                  title="Ver quem fechou e quem negocia esta cota"
                  className={`block w-full space-y-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedKey === r.key ? "ring-1 ring-foreground/30 bg-secondary/40" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{r.nome}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {int(r.vendidas)}
                      {r.meta != null && <span className="font-normal text-muted-foreground"> de {int(r.meta)}</span>}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="sp-grow h-full bg-primary" style={{ width: `${(r.vendidas / escala) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {int(r.vendidas)} {r.vendidas === 1 ? "vendida" : "vendidas"} · {int(r.emNegociacao)} em negociação
                    {r.meta != null && r.vendidas >= r.meta && <span className="font-semibold text-ok"> · meta atingida</span>}
                    {r.meta != null && r.vendidas < r.meta && <span> · faltam {int(r.meta - r.vendidas)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : comVenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cota vendida ainda.</p>
        ) : (
          <div className="space-y-4">
            {comVenda.map((r) => (
              <div key={r.key || "outros"} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{r.nome}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{brl(r.receita)}</span>
                </div>
                {r.meta != null && r.meta > 0 ? (
                  <>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="sp-grow h-full bg-primary" style={{ width: `${Math.min(r.vendidas / r.meta, 1) * 100}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {int(r.vendidas)} de {int(r.meta)} {r.meta === 1 ? "cota" : "cotas"} da meta
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    {int(r.vendidas)} {r.vendidas === 1 ? "cota vendida" : "cotas vendidas"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {aba !== "meta" && (aba === "cota" ? semNada : semVenda).length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium">
              {aba === "cota" ? "Sem venda e sem negociação:" : "Ainda sem venda:"}
              <InfoTip title={aba === "cota" ? "Sem venda e sem negociação" : "Ainda sem venda"} text={aba === "cota" ? QUOTAS_INFO.semNada : QUOTAS_INFO.semVenda} />
            </span>
            {(aba === "cota" ? semNada : semVenda).map((r) => r.nome).join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
