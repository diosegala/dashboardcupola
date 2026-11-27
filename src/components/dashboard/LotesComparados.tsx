import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf } from "@/lib/batches";
import { resumoLotes } from "@/lib/batchSummary";
import { hojeBrasilia } from "@/lib/batchCalendar";
import { comparativoLotes } from "@/lib/batchPace";
import { cn } from "@/lib/utils";
import { dataCurta } from "./BatchStatus";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const num = (n: number) => n.toLocaleString("pt-BR");
const dias = (n: number, util = true) => `${num(n)} ${util ? (n === 1 ? "dia útil" : "dias úteis") : n === 1 ? "dia" : "dias"}`;
const dia = (d: Date) => d.toLocaleDateString("sv-SE");

const INFO =
  "Responde: qual lote vende mais rápido.\n\nCada barra é a média de ingressos vendidos por dia útil enquanto o lote esteve à venda. Assim, lotes curtos e longos ficam na mesma régua, e o lote atual não parece pior só por estar no meio.\n\nVendas de fim de semana entram no total; a média é por dia útil. Respeita o período escolhido no topo da página.";

// Aba Comparativo do card Lotes: uma barra por lote, na ordem da lista de lotes (vigente primeiro, futuros fora).
export function LotesComparados({ goals, tickets, range }: { goals: any[]; tickets: Ticket[]; range?: DateRange | null }) {
  const hoje = hojeBrasilia();
  const linhas = useMemo(() => {
    const { lotes, loteAtual } = resumoLotes(goals, tickets, []);
    const vendas = splitTickets(tickets).paying.map((t) => ({ ...t, lote: batchOf(t.ticket_type) }));
    const periodo = range?.from ? { inicio: dia(range.from), fim: dia(range.to ?? range.from) } : null;
    const r = comparativoLotes(lotes, vendas, hoje, periodo);
    return { r, loteAtual, max: Math.max(...r.map((l) => l.media ?? 0), 1) };
  }, [goals, tickets, range, hoje]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Ingressos vendidos por dia útil, em média <InfoTip title="Comparativo de lotes" text={INFO} />
      </div>
      {linhas.r.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Nenhum lote à venda no período escolhido.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {linhas.r.map((l) => {
            const vigente = l.lote === linhas.loteAtual;
            return (
              <Tooltip key={l.lote} delayDuration={80}>
                <TooltipTrigger asChild>
                  <li tabIndex={0} className="cursor-default rounded-lg outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="font-semibold">
                        {l.lote}
                        {l.emAndamento && <span className="ml-2 text-xs font-normal text-muted-foreground">em andamento, dia útil {num(l.diasUteis)} de {num(l.diasUteisDoLote)}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums"><b className="font-semibold" title={l.media === null ? undefined : `Valor exato: ${fmt(l.media)}`}>{l.media === null ? "—" : Math.round(l.media).toLocaleString("pt-BR")}</b> <span className="text-xs text-muted-foreground">por dia</span></span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary">
                      <i
                        className={cn("block h-full rounded-full transition-[width] duration-700 ease-cupola", vigente ? "bg-primary" : "bg-data-blue")}
                        style={{ width: `${((l.media ?? 0) / linhas.max) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{num(l.vendidos)} ingressos em {dias(l.diasUteis)}</p>
                  </li>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs leading-relaxed">
                  <b className="mb-1 block font-semibold">{l.lote}</b>
                  <span className="block">Período: {dataCurta(l.inicio)} a {dataCurta(l.fim)}</span>
                  <span className="block">Ingressos vendidos: {num(l.vendidos)}</span>
                  <span className="block">Dias contados: {dias(l.diasCorridos, false)}, sendo {dias(l.diasUteis)}</span>
                  <span className="block">Média: {l.media === null ? "—" : fmt(l.media)} por dia útil (valor exato)</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </ul>
      )}
    </div>
  );
}
