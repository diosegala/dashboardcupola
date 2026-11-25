import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { SlidingTabsList } from "./SlidingTabsList";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { resumoLotes } from "@/lib/batchSummary";
import { batchCalendar, diaBrasilia, faltamDatas, hojeBrasilia, loteVigente } from "@/lib/batchCalendar";
import { lotesDoRitmo, ritmoNecessario, ritmoNoPeriodo, statusDoRitmo, type VisaoRitmo } from "@/lib/batchPace";
import { Card } from "@/components/ui/card";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { CountUp } from "@/components/CountUp";
import { cn } from "@/lib/utils";
import { CompareLine } from "@/components/CompareLine";
import { AvisoDatas } from "./BatchStatus";

const EVENTO = "__evento";
const CHIP: Record<string, { label: string; variant: ChipVariant }> = {
  achieved: { label: "Meta atingida", variant: "paid" },
  above: { label: "Acima do ritmo", variant: "ok" },
  on_track: { label: "No ritmo", variant: "ok" },
  below: { label: "Abaixo do ritmo", variant: "warn" },
};

interface PaceGaugeProps {
  tickets: Ticket[];
  goals: any[];
  eventDate: Date;
  // Evento todo: meta de pagantes do evento (tela Metas) e ritmo do ano anterior na mesma época.
  metaEvento: number | null;
  ritmoAnterior?: number | null;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Meio círculo de 180° (da esquerda para a direita), raio R, centro (CX, CY).
const R = 80;
const CX = 100;
const CY = 96;
const point = (frac: number, r = R) => {
  const a = Math.PI * (1 - frac);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arcLength = Math.PI * R;

// Velocímetro do ritmo por seleção (lote ou evento todo) e visão (até hoje ou total).
export function PaceGauge({ tickets, goals, eventDate, metaEvento, ritmoAnterior, className }: PaceGaugeProps) {
  const hoje = hojeBrasilia();
  const calendario = batchCalendar();
  const faltaData = faltamDatas(calendario);
  const opcoes = useMemo(() => (faltaData ? [] : lotesDoRitmo(calendario, hoje)), [calendario, faltaData, hoje]);
  const vigente = faltaData ? null : loteVigente(calendario, hoje).lote;
  const [escolha, setEscolha] = useState<string | null>(null);
  const [visao, setVisao] = useState<VisaoRitmo>("ate_hoje");
  const padrao = vigente && opcoes.some((o) => o.name === vigente) ? vigente : EVENTO;
  const selecao = escolha && (escolha === EVENTO || opcoes.some((o) => o.name === escolha)) ? escolha : padrao;
  const lote = opcoes.find((o) => o.name === selecao) ?? null;

  const pagos = useMemo(() => splitTickets(tickets).paying, [tickets]);
  const calc = useMemo(() => {
    let inicio: string, fim: string, meta: number | null;
    if (lote) {
      inicio = lote.start_date!;
      fim = lote.end_date!;
      meta = resumoLotes(goals, tickets, []).lotes.find((l) => l.lote === lote.name)?.meta ?? null;
    } else {
      inicio = pagos.reduce((m, t) => (t.sold_at && diaBrasilia(t.sold_at) < m ? diaBrasilia(t.sold_at) : m), hoje);
      fim = diaBrasilia(addDays(eventDate, -1));
      meta = metaEvento;
    }
    const r = ritmoNoPeriodo(pagos, inicio, fim, hoje, visao);
    // Meta conta todos os pagantes da seleção (inclusive os sem data), como no card de lotes.
    const pagantesMeta = lote ? resumoLotes(goals, tickets, []).lotes.find((l) => l.lote === lote.name)?.pagantes ?? r.pagantes : pagos.reduce((s, t) => s + (t.quantity || 0), 0);
    const n = ritmoNecessario(meta, pagantesMeta, r.diasRestantes);
    return { ...r, ...n, status: statusDoRitmo(r.ritmo, n.necessario, n.faltam) };
  }, [lote, pagos, goals, tickets, hoje, visao, eventDate, metaEvento]);

  const nomeSelecao = lote ? lote.name : "Evento todo";
  const currentPace = calc.ritmo ?? 0;
  const requiredPace = calc.necessario;
  const naoIniciado = calc.situacao === "nao_iniciado";
  const dif = requiredPace !== null ? currentPace - requiredPace : 0;
  const base = calc.status ? CHIP[calc.status] : null;
  const chip = base && (calc.status === "above" || calc.status === "below")
    ? { ...base, label: `${base.label} · ${dif > 0 ? "+" : "−"}${Math.abs(dif).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia` }
    : base;
  const quando = visao === "total" && calc.situacao !== "encerrado" ? (lote ? "no lote inteiro" : "no período inteiro") : "até hoje";
  const fonte = `${calc.pagantes.toLocaleString("pt-BR")} pagantes ÷ ${calc.dias.toLocaleString("pt-BR")} ${calc.dias === 1 ? "dia útil" : "dias úteis"} ${lote ? `do ${lote.name}` : "do evento"} ${quando}`;

  // Escala vai até o dobro do necessário (ou até o atual, se passar disso).
  const temMeta = requiredPace !== null;
  const max = temMeta ? Math.max((requiredPace as number) * 2, currentPace * 1.1, 1) : Math.max(currentPace * 1.4, 1);
  const atualFrac = Math.min(currentPace / max, 1);
  const necessarioFrac = temMeta ? Math.min((requiredPace as number) / max, 1) : 0;
  const noRitmo = temMeta && currentPace >= (requiredPace as number);
  const corArco = !temMeta ? "hsl(var(--data-blue))" : noRitmo ? "hsl(var(--ok))" : "hsl(var(--warn))";

  // Preenche ao aparecer (1,2 s), como o anel da meta.
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFrac(atualFrac));
    return () => cancelAnimationFrame(id);
  }, [atualFrac]);

  const marcaIn = point(necessarioFrac, R - 14);
  const marcaOut = point(necessarioFrac, R + 14);
  const rotulo = point(necessarioFrac, R + 26);

  return (
    <Card className={cn("flex flex-col gap-2 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        Ritmo de vendas <InfoTip title="Ritmo de vendas" />
      </div>
      <Tabs value={selecao} onValueChange={setEscolha}>
        <SlidingTabsList value={selecao} className="h-auto flex-wrap justify-start">
          {opcoes.map((o) => (
            <TabsTrigger key={o.name} value={o.name} className="relative z-[1] px-2.5 py-1 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              {o.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value={EVENTO} className="relative z-[1] px-2.5 py-1 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
            Evento todo
          </TabsTrigger>
        </SlidingTabsList>
      </Tabs>
      <Tabs value={visao} onValueChange={(v) => setVisao(v as VisaoRitmo)}>
        <SlidingTabsList value={visao} className="h-8">
          <TabsTrigger value="ate_hoje" className="relative z-[1] px-2.5 py-1 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">Até hoje</TabsTrigger>
          <TabsTrigger value="total" className="relative z-[1] px-2.5 py-1 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">Total</TabsTrigger>
        </SlidingTabsList>
      </Tabs>
      <span className="text-xs text-muted-foreground">
        Medindo: <b className="font-semibold text-foreground">{nomeSelecao}</b> · {visao === "ate_hoje" ? "até hoje" : "período inteiro"}
      </span>
      {faltaData && <AvisoDatas compacto />}
      <div className="flex flex-1 flex-col justify-between gap-4">
        <svg viewBox="0 -28 200 144" className="mx-auto h-auto w-full max-w-[200px] shrink-0" role="img" aria-label={`Ritmo atual ${fmt(currentPace)} por dia útil${temMeta ? `; necessário ${fmt(requiredPace as number)}` : ""}`}>
          <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="hsl(var(--secondary))" strokeWidth="16" strokeLinecap="round" />
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={corArco}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-[1200ms] ease-cupola motion-reduce:transition-none"
          />
          {temMeta && (
            <>
              <line x1={marcaIn.x} y1={marcaIn.y} x2={marcaOut.x} y2={marcaOut.y} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
              <text x={rotulo.x} y={rotulo.y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
                Meta {fmt(Math.ceil(requiredPace as number))}
              </text>
            </>
          )}
          <text x={CX} y={CY - 22} textAnchor="middle" className="fill-foreground text-[30px] font-semibold tracking-[-0.035em]">
            {fmt(currentPace)}
          </text>
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            vendidos/dia útil
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Ritmo {lote ? `do ${lote.name}` : "do evento"}</span>
            <span><b className="font-semibold text-foreground">{fmt(currentPace)}</b> <span className="text-muted-foreground">por dia útil</span></span>
            <span className="text-xs text-muted-foreground">{fonte}</span>
          </div>
          {temMeta ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">Ritmo necessário {lote ? `no ${lote.name}` : "no evento"}</span>
              <span><b className="font-semibold text-foreground"><CountUp value={Math.ceil(requiredPace as number)} format={(n) => fmt(Math.round(n))} /></b> <span className="text-muted-foreground">por dia útil</span></span>
              <span className="text-xs text-muted-foreground">{calc.faltam.toLocaleString("pt-BR")} faltam ÷ {calc.diasRestantes.toLocaleString("pt-BR")} dias úteis {lote ? "até o fim do lote" : "até o evento"}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{lote ? "Defina a meta do lote na aba Metas" : "Defina a meta de pagantes na aba Metas"}</span>
          )}
          {!lote && <CompareLine anterior={ritmoAnterior} atual={currentPace} formato={(n) => `${fmt(n)}/dia`} quando="nesta época" />}
          {chip && (
            <span className="flex flex-wrap items-center gap-1.5">
              <Chip variant={chip.variant}>{chip.label}</Chip>
              <span className="text-xs text-muted-foreground">{lote ? `meta do ${lote.name}` : "meta do evento"}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
