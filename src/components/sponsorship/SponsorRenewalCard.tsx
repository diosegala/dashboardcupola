import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import type { RenewalRow, RenewalState } from "@/lib/sponsorshipExtra";
import { cn } from "@/lib/utils";
import { CardTabs } from "./CardTabs";
import { BarList, CrmWarning, DetailsToggle, MiniStat, brlShort, int } from "./parts";

export const RENEWAL_INFO = {
  card: "Patrocinadores da edição anterior e o que fizeram nesta: renovou, subiu, desceu, está em negociação ou ainda sem negócio. Receita em risco = quanto pagaram na edição anterior as empresas que ainda não têm negócio nesta.",
  porEmpresa: "Quantas empresas da edição anterior estão em cada situação. Subiu e desceu comparam o valor desta edição com o da anterior.",
  porCota: "Cotas da edição anterior contra as desta, contando as empresas que patrocinaram as duas.",
  risco: "Soma do que pagaram na edição anterior as empresas que ainda não têm negócio aberto nem ganho nesta.",
  renovaram: "Empresas da edição anterior que já fecharam nesta (renovou, subiu ou desceu).",
  colEmpresa: "Empresa do negócio no Pipedrive.",
  colAnterior: "Valor da empresa na edição anterior.",
  colAtual: "Valor da empresa nesta edição.",
  colSituacao: "Renovou (mesmo valor), subiu, desceu, em negociação ou sem negócio.",
};

const ESTADOS: Record<RenewalState, { label: string; tone?: "warn" | "muted" }> = {
  subiu: { label: "Subiu" },
  renovou: { label: "Renovou" },
  desceu: { label: "Desceu", tone: "warn" },
  negociando: { label: "Em negociação", tone: "muted" },
  sem_negocio: { label: "Sem negócio", tone: "warn" },
};

export function SponsorRenewalCard({ rows, rotuloAnterior, cotaAnteriorFalta, oficial = false, className }: { rows: RenewalRow[]; rotuloAnterior: string; cotaAnteriorFalta: boolean; oficial?: boolean; className?: string }) {
  const [aba, setAba] = useState<"empresa" | "cota">("empresa");
  const [aberto, setAberto] = useState(false);
  const risco = rows.filter((r) => r.estado === "sem_negocio").reduce((t, r) => t + r.anterior, 0);
  const renovaram = rows.filter((r) => ["subiu", "renovou", "desceu"].includes(r.estado)).length;
  const cotas = new Map<string, { anterior: number; atual: number }>();
  for (const r of rows) {
    if (r.cotaAnterior) {
      const c = cotas.get(r.cotaAnterior) ?? { anterior: 0, atual: 0 };
      c.anterior += 1;
      cotas.set(r.cotaAnterior, c);
    }
    if (r.cotaAtual) {
      const c = cotas.get(r.cotaAtual) ?? { anterior: 0, atual: 0 };
      c.atual += 1;
      cotas.set(r.cotaAtual, c);
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Renovação <InfoTip title="Renovação" text={RENEWAL_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{int(rows.length)} patrocinadores {rotuloAnterior ? `de ${rotuloAnterior}` : "da edição anterior"}</p>
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "empresa", label: "Por empresa", info: RENEWAL_INFO.porEmpresa },
            { value: "cota", label: "Por cota", info: RENEWAL_INFO.porCota },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum patrocinador da edição anterior encontrado no funil do evento.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Renovaram" value={`${int(renovaram)} de ${int(rows.length)}`} info={RENEWAL_INFO.renovaram} />
              <MiniStat label="Receita em risco" value={brlShort(risco)} info={RENEWAL_INFO.risco} tone={risco > 0 ? "warn" : undefined} sub={`${int(rows.filter((r) => r.estado === "sem_negocio").length)} empresas sem negócio`} />
            </div>
            {aba === "empresa" ? (
              <BarList
                items={(Object.keys(ESTADOS) as RenewalState[]).map((k) => {
                  const n = rows.filter((r) => r.estado === k).length;
                  return { key: k, label: ESTADOS[k].label, value: n, text: int(n), tone: ESTADOS[k].tone };
                })}
              />
            ) : cotas.size === 0 ? (
              <p className="text-sm text-muted-foreground">Sem cota identificada nas duas edições.</p>
            ) : (
              <BarList
                color="bg-data-blue"
                items={[...cotas.entries()].map(([cota, c]) => ({ key: cota, label: cota, value: Math.max(c.anterior, c.atual), text: `${int(c.anterior)} → ${int(c.atual)}`, sub: `${rotuloAnterior || "Anterior"}: ${int(c.anterior)} · agora: ${int(c.atual)}` }))}
              />
            )}
            <div className="flex justify-end">
              <DetailsToggle open={aberto} onToggle={() => setAberto((v) => !v)} count={rows.length} />
            </div>
            {aberto && (
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-[11px] text-muted-foreground">
                      {[
                        ["Empresa", RENEWAL_INFO.colEmpresa, ""],
                        [rotuloAnterior || "Anterior", RENEWAL_INFO.colAnterior, "text-right"],
                        ["Agora", RENEWAL_INFO.colAtual, "text-right"],
                        ["Situação", RENEWAL_INFO.colSituacao, ""],
                      ].map(([t, i, c]) => (
                        <th key={t} className={cn("px-2 pb-2 font-medium first:pl-0", c)}>
                          <span className="inline-flex items-center gap-1.5">
                            {t}
                            <InfoTip title={t} text={i} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.orgId}-${r.empresa}`} className="border-t">
                        <td className="py-2 pr-2 font-medium">{r.empresa}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{brlShort(r.anterior)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.atual ? brlShort(r.atual) : "—"}</td>
                        <td className={cn("px-2 py-2", ESTADOS[r.estado].tone === "warn" && "text-warn")}>{ESTADOS[r.estado].label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <CrmWarning
          notes={[
            !oficial &&
              "Edição anterior: vem dos negócios ganhos no funil do Pipedrive no período da edição anterior, pelo valor dos produtos do evento (ou do negócio). Os números oficiais entram com a importação da planilha.",
            cotaAnteriorFalta && "Cota da edição anterior: os produtos da edição anterior não têm a cota no nome, então a aba Por cota depende da importação da planilha.",
          ]}
        />
      </CardContent>
    </Card>
  );
}
