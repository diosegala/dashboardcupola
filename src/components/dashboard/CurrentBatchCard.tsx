import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { CountUp } from "@/components/CountUp";
import { CompareLine } from "@/components/CompareLine";
import { useCompare } from "@/hooks/useCompare";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf } from "@/lib/batches";
import { progressoLote, resumoLotes } from "@/lib/batchSummary";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  goals: any[];
  allTimeTickets?: Ticket[];
  previousYearTickets?: Ticket[];
  className?: string;
}

const R = 52;
const C = 2 * Math.PI * R;

// Destaque do lote à venda agora: vendidos x meta do lote, saldo, receita e vendas recentes.
export function CurrentBatchCard({ goals, allTimeTickets = [], previousYearTickets = [], className }: Props) {
  const { ativo: comparar } = useCompare();
  const dados = useMemo(() => {
    const { lotes, loteAtual } = resumoLotes(goals, allTimeTickets, previousYearTickets);
    const lote = lotes.find((l) => l.lote === loteAtual) ?? null;
    if (!lote) return null;
    const hoje = new Date();
    const chaveHoje = hoje.toLocaleDateString("sv-SE");
    const seteDias = new Date(hoje.getTime() - 7 * 86400000).toISOString();
    let vHoje = 0;
    let v7 = 0;
    splitTickets(allTimeTickets).paying.forEach((t) => {
      if (batchOf(t.ticket_type) !== lote.lote || !t.sold_at) return;
      const q = t.quantity || 0;
      if (new Date(t.sold_at).toLocaleDateString("sv-SE") === chaveHoje) vHoje += q;
      if (t.sold_at >= seteDias) v7 += q;
    });
    return { lote, vHoje, v7 };
  }, [goals, allTimeTickets, previousYearTickets]);

  return (
    <Card className={cn("flex flex-col gap-4 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        Lote vigente <InfoTip title="Lote vigente" />
      </div>
      {!dados ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma venda por lote ainda.</p>
      ) : (
        <Conteudo {...dados} comparar={comparar} />
      )}
    </Card>
  );
}

function Conteudo({ lote, vHoje, v7, comparar }: { lote: ReturnType<typeof resumoLotes>["lotes"][number]; vHoje: number; v7: number; comparar: boolean }) {
  const { pct, saldo } = progressoLote(lote.pagantes, lote.meta);
  const frac = pct === null ? 1 : Math.min(pct, 1);
  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="text-lg font-semibold leading-tight">{lote.lote}</div>
      <svg viewBox="0 0 140 140" className="mx-auto h-auto w-full max-w-[170px]" role="img" aria-label={`${lote.pagantes} vendidos${lote.meta ? ` de ${lote.meta}` : ""}`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke={pct === null ? "hsl(var(--muted-foreground) / 0.35)" : "hsl(var(--primary))"}
          strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="70" textAnchor="middle" className="fill-foreground text-[26px] font-semibold tracking-[-0.035em]">{int(lote.pagantes)}</text>
        <text x="70" y="88" textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {lote.meta ? `de ${int(lote.meta)}` : "vendidos"}
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
        {pct !== null ? (
          <>
            <Item rotulo="% vendido" valor={`${Math.round(pct * 100)}%`} />
            <Item rotulo="Saldo" valor={int(saldo as number)} />
          </>
        ) : (
          <p className="col-span-2 text-xs text-muted-foreground">Defina a meta do lote na aba Metas</p>
        )}
        <Item rotulo="Receita do lote" valor={<CountUp value={lote.receita} format={brl} />} />
        <Item rotulo="\n" valor="\n" />
      </div>
      {comparar && lote.anterior !== null && (
        <CompareLine anterior={lote.anterior} atual={lote.pagantes} formato={int} quando="no mesmo lote" />
      )}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
      <b className="font-semibold tabular-nums text-foreground">{valor}</b>
    </div>
  );
}
