import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardTabs } from "./CardTabs";
import { InfoTip } from "@/components/InfoTip";
import { CompareLine } from "@/components/CompareLine";
import { ADDONS_KEY, type QuotaRow } from "@/lib/sponsorshipMetrics";
import { cn } from "@/lib/utils";
import { brl } from "./SponsorRevenueCard";

export const QUOTAS_INFO = {
  card: "Quantidade do produto da cota em negócios ganhos. Um negócio com 2 unidades conta 2 cotas.",
  porCota: "Cotas vendidas contra a meta de cada cota (menu Metas), vagas que ainda restam e unidades em negócios abertos. Produto do evento sem cota pelo nome entra em \"Outros produtos do evento\".",
  receita: "Quanto cada cota somou em vendas, a parte de cada uma no total vendido e o valor médio de cada cota vendida (receita da cota ÷ cotas vendidas).",
};

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (n: number) => `${Math.round(n * 100).toLocaleString("pt-BR")}%`;

function QuotaBar({ row, escala }: { row: QuotaRow; escala: number }) {
  const total = row.meta ?? row.vagas ?? escala;
  const base = Math.max(total, row.vendidas + row.emNegociacao, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className={cn("font-semibold", (row.key === "" || row.key === ADDONS_KEY) && "text-muted-foreground")}>{row.nome}</span>
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

function RevenueBar({ row, total, maior }: { row: QuotaRow; total: number; maior: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className={cn("font-semibold", row.key === "" && "text-muted-foreground")}>{row.nome}</span>
        <span className="tabular-nums">
          <b className="font-semibold">{brl(row.receita)}</b>
          <span className="ml-1.5 text-muted-foreground">{total > 0 ? pct(row.receita / total) : "0%"}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-data-blue transition-[width] duration-700 ease-cupola" style={{ width: `${maior > 0 ? (row.receita / maior) * 100 : 0}%` }} />
      </div>
      <div className="text-[11px] text-muted-foreground">
        {row.vendidas > 0 ? `${int(row.vendidas)} ${row.vendidas === 1 ? "vendida" : "vendidas"} · média de ${brl(row.receita / row.vendidas)} por cota` : "Nenhuma vendida"}
      </div>
    </div>
  );
}

export function SponsorQuotasCard({ rows, cotasAnterior = null, className }: { rows: QuotaRow[]; cotasAnterior?: number | null; className?: string }) {
  const [aba, setAba] = useState<"cota" | "receita">("cota");
  // Total do cabeçalho: só as cotas (adicionais e "Outros produtos do evento" não são cota).
  const vendidas = rows.filter((r) => r.key !== "" && r.key !== ADDONS_KEY).reduce((s, r) => s + r.vendidas, 0);
  const meta = rows.reduce((s, r) => s + (r.meta ?? 0), 0);
  const escala = Math.max(...rows.map((r) => r.vendidas + r.emNegociacao), 1);
  const receitaTotal = rows.reduce((s, r) => s + r.receita, 0);
  const maiorReceita = Math.max(...rows.map((r) => r.receita), 0);

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
          <CompareLine className="mt-1" anterior={cotasAnterior} atual={vendidas} />
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "cota", label: "Por cota", info: QUOTAS_INFO.porCota },
            { value: "receita", label: "Receita por cota", info: QUOTAS_INFO.receita },
          ]}
        />
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cota configurada para este evento.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {rows.map((r) =>
              aba === "cota" ? (
                <QuotaBar key={r.key || "outros"} row={r} escala={escala} />
              ) : (
                <RevenueBar key={r.key || "outros"} row={r} total={receitaTotal} maior={maiorReceita} />
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
