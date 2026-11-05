import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardTabs } from "./CardTabs";
import { InfoTip } from "@/components/InfoTip";
import type { QuotaRow } from "@/lib/sponsorshipMetrics";
import { cn } from "@/lib/utils";
import { brl } from "./SponsorRevenueCard";

export const QUOTAS_INFO = {
  card: "Quantidade do produto da cota em negócios ganhos. Preço médio abaixo da tabela mostra o desconto dado.",
  porCota: "Cotas vendidas contra a meta de cada cota (menu Metas), vagas que ainda restam e unidades em negócios abertos. Produto do evento sem cota pelo nome entra em \"Outros produtos do evento\".",
  preco: "Receita da cota ÷ cotas vendidas, comparado com o preço de tabela da configuração do evento. Sem preço de tabela, o desconto não aparece.",
  colPrecoMedio: "Receita da cota ÷ quantidade vendida.",
  colTabela: "Preço de tabela da cota, da configuração do evento.",
  colDesconto: "Quanto o preço médio ficou abaixo da tabela.",
};

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => `${Math.round(n * 100).toLocaleString("pt-BR")}%`;

function Th({ text, info, className }: { text: string; info: string; className?: string }) {
  return (
    <th className={cn("pb-2 text-[11px] font-medium text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        {text}
        <InfoTip title={text} text={info} />
      </span>
    </th>
  );
}

function QuotaBar({ row, escala }: { row: QuotaRow; escala: number }) {
  const total = row.meta ?? row.vagas ?? escala;
  const base = Math.max(total, row.vendidas + row.emNegociacao, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className={cn("font-semibold", row.key === "" && "text-muted-foreground")}>{row.nome}</span>
        <span className="tabular-nums text-foreground/85">
          <b className="font-semibold">{int(row.vendidas)}</b>
          {row.meta != null && <span className="text-muted-foreground"> de {int(row.meta)}</span>}
        </span>
      </div>
      <div className="relative flex h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary transition-[width] duration-700 ease-cupola" style={{ width: `${(row.vendidas / base) * 100}%` }} />
        <div className="h-full bg-primary/30" style={{ width: `${(row.emNegociacao / base) * 100}%` }} title="Em negociação" />
      </div>
      <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
        {row.restantes != null && <span>{row.restantes === 0 ? "Sem vagas" : `${int(row.restantes)} ${row.restantes === 1 ? "vaga restante" : "vagas restantes"}`}</span>}
        <span>{int(row.emNegociacao)} em negociação</span>
        {row.meta != null && row.vendidas >= row.meta && <span className="font-semibold text-ok">Meta atingida</span>}
      </div>
    </div>
  );
}

export function SponsorQuotasCard({ rows, className }: { rows: QuotaRow[]; className?: string }) {
  const [aba, setAba] = useState<"cota" | "preco">("cota");
  // Total do cabeçalho: só as cotas (a linha "Outros produtos do evento" não é cota).
  const vendidas = rows.filter((r) => r.key !== "").reduce((s, r) => s + r.vendidas, 0);
  const meta = rows.reduce((s, r) => s + (r.meta ?? 0), 0);
  const escala = Math.max(...rows.map((r) => r.vendidas + r.emNegociacao), 1);
  const comPreco = rows.filter((r) => r.key !== "" && r.vendidas > 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Cotas vendidas <InfoTip title="Cotas vendidas" text={QUOTAS_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            <b className="font-semibold text-foreground">{int(vendidas)}</b> {vendidas === 1 ? "cota vendida" : "cotas vendidas"}
            {meta > 0 && <> de {int(meta)} na meta</>}
          </p>
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "cota", label: "Por cota", info: QUOTAS_INFO.porCota },
            { value: "preco", label: "Preço médio x tabela", info: QUOTAS_INFO.preco },
          ]}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cota configurada para este evento.</p>
        ) : aba === "cota" ? (
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {rows.map((r) => (
              <QuotaBar key={r.key || "outros"} row={r} escala={escala} />
            ))}
          </div>
        ) : comPreco.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cota vendida ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr>
                  <Th text="Cota" info="Nível de cota da configuração do evento. Só aparecem as cotas com venda." />
                  <Th text="Preço médio" info={QUOTAS_INFO.colPrecoMedio} className="text-right" />
                  <Th text="Tabela" info={QUOTAS_INFO.colTabela} className="text-right" />
                  <Th text="Desconto" info={QUOTAS_INFO.colDesconto} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {comPreco.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-2.5 font-medium">{r.nome}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.precoMedio != null ? brl(r.precoMedio) : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{r.precoTabela != null ? brl(r.precoTabela) : "—"}</td>
                    <td className={cn("py-2.5 text-right font-semibold tabular-nums", r.desconto != null && r.desconto > 0.005 ? "text-warn" : "text-foreground/70")}>
                      {r.desconto == null ? "—" : r.desconto > 0.005 ? pct(r.desconto) : "Sem desconto"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
