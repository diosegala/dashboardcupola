import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import type { OwnerLine, OwnerSummary, QuotaRow } from "@/lib/sponsorshipMetrics";
import { brl } from "./SponsorRevenueCard";

const INFO =
  "Cada negócio do Pipedrive conta para o responsável (proprietário) dele. Fechamentos são os negócios ganhos nesta edição; negociações são os negócios abertos, com a etapa atual do funil. Os números são os mesmos das barras de cotas. Clique numa cota em \"Por cota\" para ver só ela.";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dia = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

function Linha({ l, aberto }: { l: OwnerLine; aberto?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{l.empresa}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {l.quantidade > 1 ? `${int(l.quantidade)}× ` : ""}
          {l.produto} · {aberto ? l.etapa || "Etapa não informada" : dia(l.quando)}
        </span>
      </span>
      <span className="shrink-0 tabular-nums font-medium">{brl(l.valor)}</span>
    </li>
  );
}

export function SponsorOwnersCard({
  owners,
  rows,
  selectedKey,
  onClear,
  className,
}: {
  owners: OwnerSummary[];
  rows: QuotaRow[];
  selectedKey: string | null;
  onClear: () => void;
  className?: string;
}) {
  const cota = selectedKey != null ? rows.find((r) => r.key === selectedKey) : undefined;
  const filtra = (ls: OwnerLine[]) => (selectedKey == null ? ls : ls.filter((l) => l.cotaKey === selectedKey));
  const lista = owners
    .map((o) => ({ o, f: filtra(o.fechados), a: filtra(o.abertos) }))
    .sort((x, y) => Number(y.f.length + y.a.length > 0) - Number(x.f.length + x.a.length > 0));

  return (
    <Card className={className}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2">
          Vendas por responsável <InfoTip title="Vendas por responsável" text={INFO} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">Quem fechou e quem está negociando cada cota, com os dados do Pipedrive. Negócios perdidos não aparecem.</p>
        {cota && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium">Cota: {cota.nome}</span>
            <button type="button" onClick={onClear} className="font-medium text-muted-foreground underline-offset-2 hover:underline">
              Ver todas
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fechamento nem negociação ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lista.map(({ o, f, a }) => {
              const ativo = f.length + a.length > 0;
              const qf = f.reduce((s, l) => s + l.quantidade, 0);
              const vf = f.reduce((s, l) => s + l.valor, 0);
              const qa = a.reduce((s, l) => s + l.quantidade, 0);
              const va = a.reduce((s, l) => s + l.valor, 0);
              if (selectedKey == null && !ativo) return null;
              return (
                <div key={o.nome} className={`rounded-xl border p-3 transition-opacity ${ativo ? "" : "opacity-40"}`}>
                  <div className="truncate text-sm font-semibold">{o.nome}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>
                      <div className="inline-flex items-center gap-1.5">
                        <i className="h-2 w-2 rounded-full bg-primary" /> Fechado
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{int(qf)} · {brl(vf)}</div>
                    </div>
                    <div>
                      <div>Em negociação</div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{int(qa)} · {brl(va)}</div>
                    </div>
                  </div>
                  {f.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-medium text-muted-foreground">Fechamentos</div>
                      <ul className="divide-y">{f.map((l, i) => <Linha key={`${l.dealId}-${i}`} l={l} />)}</ul>
                    </div>
                  )}
                  {a.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] font-medium text-muted-foreground">Em negociação</div>
                      <ul className="divide-y">{a.map((l, i) => <Linha key={`${l.dealId}-${i}`} l={l} aberto />)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
