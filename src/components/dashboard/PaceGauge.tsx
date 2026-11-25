import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import type { DateRange } from "@/hooks/useDashboardData";
import { resumoLotes } from "@/lib/batchSummary";
import { batchCalendar, diaBrasilia, faltamDatas, hojeBrasilia, loteVigente } from "@/lib/batchCalendar";
import { nivelDoRitmo, loteAnterior, lotesDoRitmo, marcoInicial, pagantesForaDeLote, ritmoNecessario, ritmoNoPeriodo, somarDias, statusDoRitmo } from "@/lib/batchPace";
import { Card } from "@/components/ui/card";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { CountUp } from "@/components/CountUp";
import { cn } from "@/lib/utils";
import { CompareLine } from "@/components/CompareLine";
import { AvisoDatas } from "./BatchStatus";

const EVENTO = "__evento";
const PERIODO = "__periodo";
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
  // Meta de pagantes do evento (tela Metas) e ritmo do ano anterior na mesma época (só no Evento todo).
  metaEvento: number | null;
  // Período escolhido no topo: vira a opção "Período filtrado" e o card abre nela.
  filtrado?: boolean;
  range?: DateRange;
  ritmoAnterior?: number | null;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const num = (n: number) => n.toLocaleString("pt-BR");
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const ddmmaaaa = (dia: string) => `${ddmm(dia)}/${dia.slice(0, 4)}`;
const du = (n: number) => `${num(n)} ${n === 1 ? "dia útil" : "dias úteis"}`;

// Meio círculo de 180° (da esquerda para a direita), raio R, centro (CX, CY).
const R = 80;
const CX = 100;
const CY = 96;
const point = (frac: number, r = R) => {
  const a = Math.PI * (1 - frac);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arcLength = Math.PI * R;

// Velocímetro do ritmo por recorte (período filtrado, lote ou evento todo), sempre consolidado até hoje.
export function PaceGauge({ tickets, goals, eventDate, metaEvento, ritmoAnterior, filtrado, range, className }: PaceGaugeProps) {
  const hoje = hojeBrasilia();
  const calendario = batchCalendar();
  const faltaData = faltamDatas(calendario);
  const opcoes = useMemo(() => (faltaData ? [] : lotesDoRitmo(calendario, hoje)), [calendario, faltaData, hoje]);
  const vigente = faltaData ? null : loteVigente(calendario, hoje).lote;
  const periodo = filtrado && range ? { inicio: diaBrasilia(range.from), fim: diaBrasilia(range.to) } : null;
  const chavePeriodo = periodo ? `${periodo.inicio}|${periodo.fim}` : "";
  const [escolha, setEscolha] = useState<string | null>(null);
  // Ao filtrar (ou limpar) o período no topo, o card volta para o padrão.
  useEffect(() => setEscolha(null), [chavePeriodo]);
  const padrao = periodo ? PERIODO : vigente && opcoes.some((o) => o.name === vigente) ? vigente : EVENTO;
  const valida = (v: string) => v === EVENTO || (v === PERIODO && !!periodo) || opcoes.some((o) => o.name === v);
  const selecao = escolha && valida(escolha) ? escolha : padrao;
  const lote = opcoes.find((o) => o.name === selecao) ?? null;
  const emPeriodo = selecao === PERIODO && periodo ? periodo : null;
  // Lista: período filtrado, lote vigente, demais lotes (cronológico), evento todo.
  const lista = useMemo(() => {
    const v = opcoes.filter((o) => o.name === vigente);
    return [...v, ...opcoes.filter((o) => o.name !== vigente)];
  }, [opcoes, vigente]);

  const pagos = useMemo(() => splitTickets(tickets).paying, [tickets]);
  const calc = useMemo(() => {
    const resumo = resumoLotes(goals, tickets, []).lotes;
    const vespera = diaBrasilia(addDays(eventDate, -1));
    const marco = marcoInicial(pagos) ?? hoje;
    const totalPagantes = pagos.reduce((s, t) => s + (t.quantity || 0), 0);
    // Evento todo: do marco (venda paga mais antiga) até a véspera, todas as vendas pagas.
    const evento = ritmoNoPeriodo(pagos, marco, vespera, hoje, "ate_hoje", true);
    const nEvento = ritmoNecessario(metaEvento, totalPagantes, evento.diasRestantes);

    let r = evento, n = nEvento, metaLote: number | null = null;
    if (lote) {
      r = ritmoNoPeriodo(pagos, lote.start_date!, lote.end_date!, hoje, "ate_hoje");
      const l = resumo.find((x) => x.lote === lote.name);
      metaLote = l?.meta ?? null;
      n = ritmoNecessario(metaLote, l?.pagantes ?? r.pagantes, r.diasRestantes);
    } else if (emPeriodo) {
      r = ritmoNoPeriodo(pagos, emPeriodo.inicio, emPeriodo.fim, hoje, "ate_hoje");
    }
    const ant = lote ? loteAnterior(opcoes, lote.name) : null;
    const rAnt = ant ? ritmoNoPeriodo(pagos, ant.start_date!, ant.end_date!, hoje, "ate_hoje").ritmo : null;
    const semana = ritmoNoPeriodo(pagos, somarDias(hoje, -6), hoje, hoje, "ate_hoje");
    const fora = lote ? 0 : emPeriodo ? pagantesForaDeLote(pagos, calendario, emPeriodo.inicio, emPeriodo.fim) : pagantesForaDeLote(pagos, calendario);
    // Velocímetro: compara com o necessário do recorte (lote com meta) ou do evento.
    const comparar = lote && metaLote ? n : nEvento;
    return { r, n, nEvento, evento, metaLote, marco, ant, rAnt, semana, fora, comparar, status: statusDoRitmo(r.ritmo, comparar.necessario, comparar.faltam) };
  }, [lote, emPeriodo, opcoes, pagos, goals, tickets, hoje, eventDate, metaEvento, calendario]);

  const nome = lote ? lote.name : emPeriodo ? "período filtrado" : "evento";
  const currentPace = calc.r.ritmo ?? 0;
  const requiredPace = calc.comparar.necessario;
  const dif = requiredPace !== null ? currentPace - requiredPace : 0;
  const base = calc.status ? CHIP[calc.status] : null;
  const chip = base && (calc.status === "above" || calc.status === "below")
    ? { ...base, label: `${base.label} · ${dif > 0 ? "+" : "−"}${Math.abs(dif).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia` }
    : base;
  const fonte = `${num(calc.r.pagantes)} pagantes ÷ ${du(calc.r.dias)}${!lote && !emPeriodo ? ` desde ${ddmmaaaa(calc.marco)}` : ""}`;
  const variacao = calc.rAnt && calc.rAnt > 0 ? (currentPace / calc.rAnt - 1) * 100 : null;

  // Escala vai até o dobro do necessário (ou até o atual, se passar disso).
  const temMeta = requiredPace !== null;
  const max = temMeta ? Math.max((requiredPace as number) * 2, currentPace * 1.1, 1) : Math.max(currentPace * 1.4, 1);
  const atualFrac = Math.min(currentPace / max, 1);
  const necessarioFrac = temMeta ? Math.min((requiredPace as number) / max, 1) : 0;
  const noRitmo = temMeta && currentPace >= (requiredPace as number);
  const nivel = nivelDoRitmo(currentPace, requiredPace, calc.comparar.faltam);
  const cor = nivel === "critico" || nivel === "risco" ? "bad" : nivel === "atencao" ? "warn" : nivel ? "ok" : null;
  const corArco = !temMeta || !cor ? "hsl(var(--data-blue))" : `hsl(var(--${cor}))`;
  const cobre = temMeta && (requiredPace as number) > 0 ? Math.round((currentPace / (requiredPace as number)) * 100) : null;
  const vezes = temMeta && currentPace > 0 ? (requiredPace as number) / currentPace : null;
  // Faixa discreta: só o título curto à vista; a conta completa aparece no hover.
  const explicacao = `No ${nome}, o ritmo atual cobre só ${cobre}% do necessário`
    + (vezes && vezes >= 1.5 ? ` — é preciso vender ${fmt(vezes)}× mais por dia útil` : "") + ".";
  const alerta = nivel === "critico"
    ? { titulo: "Risco crítico de não bater a meta", cls: "border-l-bad bg-bad-bg text-bad", peso: "font-semibold" }
    : nivel === "risco"
    ? { titulo: "Ritmo muito abaixo do necessário", cls: "border-l-bad bg-bad-bg text-bad", peso: "font-medium" }
    : nivel === "atencao"
    ? { titulo: "Atenção: ritmo um pouco abaixo", cls: "border-l-warn bg-warn-bg text-warn", peso: "font-medium" }
    : null;

  // Preenche ao aparecer (1,2 s), como o anel da meta.
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFrac(atualFrac));
    return () => cancelAnimationFrame(id);
  }, [atualFrac]);

  const marcaIn = point(necessarioFrac, R - 14);
  const marcaOut = point(necessarioFrac, R + 14);
  const rotulo = point(necessarioFrac, R + 26);
  const loteComMeta = !!lote && calc.n.necessario !== null;

  return (
    <Card className={cn("flex flex-col gap-2 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        Ritmo de vendas <InfoTip title="Ritmo de vendas" />
      </div>
      <Select value={selecao} onValueChange={setEscolha}>
        <SelectTrigger className="h-9 w-full max-w-[240px] text-xs" aria-label="Recorte do ritmo"><SelectValue /></SelectTrigger>
        <SelectContent>
          {periodo && <SelectItem value={PERIODO}>Período filtrado · {ddmm(periodo.inicio)} a {ddmm(periodo.fim)}</SelectItem>}
          {lista.map((o) => <SelectItem key={o.name} value={o.name}>{o.name}{o.name === vigente ? " (vigente)" : ""}</SelectItem>)}
          <SelectItem value={EVENTO}>Evento todo</SelectItem>
        </SelectContent>
      </Select>
      {faltaData && <AvisoDatas compacto />}
      {alerta && cobre !== null && (
        <Tooltip delayDuration={80}>
          <TooltipTrigger asChild>
            <div
              tabIndex={0}
              aria-label={`${alerta.titulo}. ${explicacao}`}
              className={cn("flex w-fit cursor-help items-center gap-1.5 rounded-r-md border-l-2 px-2 py-[5px] text-[11px] leading-none outline-none focus-visible:ring-1 focus-visible:ring-ring", alerta.cls)}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
              <span className={cn("truncate", alerta.peso)}>{alerta.titulo}</span>
            </div>
          </TooltipTrigger>
          <TooltipPrimitive.Portal>
            <TooltipContent
              side="top"
              collisionPadding={12}
              className="max-w-[320px] whitespace-pre-line break-words rounded-xl border-0 bg-foreground px-3.5 py-2.5 text-left text-[12px] font-normal normal-case leading-[1.45] tracking-normal text-background shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)]"
            >
              <b className="mb-1 block font-semibold">{alerta.titulo}</b>
              {explicacao}
            </TooltipContent>
          </TooltipPrimitive.Portal>
        </Tooltip>
      )}
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
          <text x={CX} y={CY - 22} textAnchor="middle" className={cn("text-[30px] tracking-[-0.035em]", cor === "bad" ? "fill-bad" : cor === "warn" ? "fill-warn" : "fill-foreground")} style={{ fontWeight: 600 }} >
            {fmt(currentPace)}
          </text>
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            vendidos/dia útil
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Ritmo do {nome}</span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span><b className="font-semibold text-foreground">{fmt(currentPace)}</b> <span className="text-muted-foreground">por dia útil</span></span>
              {calc.ant && calc.rAnt !== null && (
                <span className="text-xs text-muted-foreground">
                  {calc.ant.name}: {fmt(calc.rAnt)}/dia{variacao !== null && <> · <b className={cn("font-semibold", variacao >= 0 ? "text-ok" : "text-warn")}>{variacao >= 0 ? "+" : "−"}{Math.abs(variacao).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</b></>}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">{fonte}</span>
            {!lote && calc.fora > 0 && <span className="text-xs text-muted-foreground">{num(calc.fora)} pagantes fora de lote cadastrado</span>}
          </div>
          {!lote && !emPeriodo && <CompareLine anterior={ritmoAnterior} atual={currentPace} formato={(n) => `${fmt(n)}/dia`} quando="nesta época" />}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Ritmo dos últimos 7 dias · independe da seleção</span>
            <span><b className="font-semibold text-foreground">{fmt(calc.semana.ritmo ?? 0)}</b> <span className="text-muted-foreground">por dia útil</span></span>
            <span className="text-xs text-muted-foreground">{num(calc.semana.pagantes)} pagantes ÷ {du(calc.semana.dias)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Ritmo necessário {lote ? `no ${lote.name}` : "no evento"}</span>
            {loteComMeta ? (
              <>
                <span><b className="font-semibold text-foreground"><CountUp value={Math.ceil(calc.n.necessario as number)} format={(n) => fmt(Math.round(n))} /></b> <span className="text-muted-foreground">por dia útil para bater a meta do {lote!.name}</span></span>
                <span className="text-xs text-muted-foreground">faltam {num(calc.n.faltam)} ÷ {du(calc.r.diasRestantes)} restantes no lote</span>
              </>
            ) : lote ? (
              <span className="text-xs text-muted-foreground">{lote.name} sem meta cadastrada</span>
            ) : null}
            {calc.nEvento.necessario !== null ? (
              lote ? (
                <span className="mt-1 text-xs text-muted-foreground">Para a meta do evento: <b className="font-semibold text-foreground">{fmt(Math.ceil(calc.nEvento.necessario))}</b> por dia útil · faltam {num(calc.nEvento.faltam)} ÷ {du(calc.evento.diasRestantes)} até o evento</span>
              ) : (
                <>
                  <span><b className="font-semibold text-foreground"><CountUp value={Math.ceil(calc.nEvento.necessario)} format={(n) => fmt(Math.round(n))} /></b> <span className="text-muted-foreground">por dia útil para bater a meta do evento</span></span>
                  <span className="text-xs text-muted-foreground">faltam {num(calc.nEvento.faltam)} ÷ {du(calc.evento.diasRestantes)} até o evento</span>
                </>
              )
            ) : (
              <span className="text-xs text-muted-foreground">Defina a meta de pagantes na aba Metas</span>
            )}
          </div>
          {chip && (
            <span className="flex flex-wrap items-center gap-1.5">
              <Chip variant={nivel === "critico" || nivel === "risco" ? "bad" : chip.variant}>{chip.label}</Chip>
              <span className="text-xs text-muted-foreground">{loteComMeta ? `meta do ${lote!.name}` : "meta do evento"}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
