import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { SlidingTabsList } from "./SlidingTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import type { DateRange } from "@/hooks/useDashboardData";
import { resumoLotes } from "@/lib/batchSummary";
import { batchCalendar, diaBrasilia, faltamDatas, hojeBrasilia, loteVigente } from "@/lib/batchCalendar";
import { nivelDoRitmo, loteAnterior, lotesDoRitmo, marcoInicial, pagantesForaDeLote, ritmoNecessario, ritmoNoPeriodo, somarDias, statusDoRitmo } from "@/lib/batchPace";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { cn } from "@/lib/utils";
import { CompareLine } from "@/components/CompareLine";
import { AvisoDatas } from "./BatchStatus";
import { escalaDoRitmo, GAUGE, rotuloDoMarcador } from "@/lib/paceScale";

const EVENTO = "__evento";
const PERIODO = "__periodo";

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
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const ddmmaaaa = (dia: string) => `${ddmm(dia)}/${dia.slice(0, 4)}`;
const du = (n: number) => `${num(n)} ${n === 1 ? "dia útil" : "dias úteis"}`;

// Meio círculo de 180° (da esquerda para a direita), raio R, centro (CX, CY).
const R = GAUGE.r;
const CX = GAUGE.cx;
const CY = GAUGE.cy;
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

    const noLote = (base: ReturnType<typeof ritmoNoPeriodo>, nome: string) => {
      const vendidos = resumo.find((x) => x.lote === nome)?.pagantes ?? 0;
      return { ...base, pagantes: vendidos, ritmo: base.ritmo === null ? null : base.dias > 0 ? vendidos / base.dias : vendidos };
    };
    let r = evento, n = nEvento, metaLote: number | null = null;
    if (lote) {
      // Vendidos do lote pela mesma regra do quadro Lote vigente (ingressos do produto do lote, com os faturados);
      // as datas do lote só dão os dias úteis.
      r = noLote(ritmoNoPeriodo(pagos, lote.start_date!, lote.end_date!, hoje, "ate_hoje"), lote.name);
      const l = resumo.find((x) => x.lote === lote.name);
      metaLote = l?.meta ?? null;
      n = ritmoNecessario(metaLote, r.pagantes, r.diasRestantes);
    } else if (emPeriodo) {
      r = ritmoNoPeriodo(pagos, emPeriodo.inicio, emPeriodo.fim, hoje, "ate_hoje");
    }
    const ant = lote ? loteAnterior(opcoes, lote.name) : null;
    const rAnt = ant ? noLote(ritmoNoPeriodo(pagos, ant.start_date!, ant.end_date!, hoje, "ate_hoje"), ant.name).ritmo : null;
    const semana = ritmoNoPeriodo(pagos, somarDias(hoje, -6), hoje, hoje, "ate_hoje");
    const fora = lote ? 0 : emPeriodo ? pagantesForaDeLote(pagos, calendario, emPeriodo.inicio, emPeriodo.fim) : pagantesForaDeLote(pagos, calendario);
    // Velocímetro: compara com o necessário do recorte (lote com meta) ou do evento.
    const comparar = lote && metaLote ? n : nEvento;
    // Mesma referência visual ao alternar lotes; não muda nenhuma meta ou contagem.
    const referencias = opcoes.map((o) => {
      const base = resumo.find((x) => x.lote === o.name);
      const dias = o.start_date && o.end_date
        ? ritmoNoPeriodo([], o.start_date, o.end_date, hoje, "ate_hoje").diasRestantes : 0;
      return { meta: base?.meta ?? 0, necessario: ritmoNecessario(base?.meta ?? null, base?.pagantes ?? 0, dias).necessario ?? 0 };
    });
    const escalaDia = Math.max(nEvento.necessario ?? 0, ...referencias.map((x) => x.necessario));
    const escalaLote = Math.max(0, ...referencias.map((x) => x.meta));
    return { r, n, nEvento, evento, metaLote, marco, ant, rAnt, semana, fora, comparar, escalaDia, escalaLote, status: statusDoRitmo(r.ritmo, comparar.necessario, comparar.faltam) };
  }, [lote, emPeriodo, opcoes, pagos, goals, tickets, hoje, eventDate, metaEvento, calendario]);

  const nome = lote ? lote.name : emPeriodo ? "período filtrado" : "evento";
  const currentPace = calc.r.ritmo ?? 0;
  const requiredPace = calc.comparar.necessario;

  const temMeta = requiredPace !== null;
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

  const loteComMeta = !!lote && calc.n.necessario !== null;
  // Recorte da meta: a do lote quando escolhido e com meta; senão a do evento.
  const metaDoRecorte = lote ? (loteComMeta ? calc.metaLote : null) : metaEvento;
  const alvo = lote ? `do ${lote.name}` : "do evento";
  const faltamRecorte = lote ? calc.n.faltam : calc.nEvento.faltam;
  const necRecorte = (lote ? calc.n.necessario : calc.nEvento.necessario) ?? 0;
  const diasRecorte = lote ? calc.r.diasRestantes : calc.evento.diasRestantes;
  const projecao = calc.semana.ritmo !== null ? Math.round((lote ? calc.r.pagantes : calc.evento.pagantes) + calc.semana.ritmo * diasRecorte) : null;

  // Chave de perspectiva: abre sempre no Dia. Lote e Evento mostram quanto falta até o fim de cada um.
  const [visao, setVisao] = useState<Visao>("dia");
  const vendidosRecorte = calc.r.pagantes;
  const ateLote = lote ? ` até ${ddmm(lote.end_date!)}` : "";
  // Velocímetro de acordo com a chave: ritmo por dia (Dia) ou vendidos x meta (Lote, Evento).
  const g = visao === "dia"
    ? { valor: currentPace, legenda: "ingressos por dia", marca: temMeta ? { titulo: "Precisa", valor: int(Math.ceil(requiredPace as number)) } : null, alvo: null as number | null }
    : visao === "lote"
    ? { valor: vendidosRecorte, legenda: lote && calc.metaLote ? `vendidos de ${num(calc.metaLote)}` : "vendidos", marca: lote && calc.metaLote !== null ? { titulo: "Precisa", valor: num(calc.metaLote) } : null, alvo: lote ? calc.metaLote : null }
    : { valor: calc.evento.pagantes, legenda: metaEvento ? `vendidos de ${num(metaEvento)}` : "vendidos", marca: metaEvento !== null ? { titulo: "Precisa", valor: num(metaEvento) } : null, alvo: metaEvento };
  const escala = escalaDoRitmo(g.valor, visao === "dia" ? requiredPace : g.alvo,
    visao === "dia" ? calc.escalaDia : visao === "lote" ? calc.escalaLote : 0);
  const gFrac = escala.realizado;
  const gMarcaFrac = escala.marcador ?? 0;
  const gCor = visao === "dia" ? corArco : "hsl(var(--data-blue))";
  useEffect(() => {
    const id = requestAnimationFrame(() => setFrac(gFrac));
    return () => cancelAnimationFrame(id);
  }, [gFrac]);
  const linhas: { rotulo: string; valor: React.ReactNode }[] =
    visao === "dia"
      ? [
          ...(temMeta && calc.comparar.faltam > 0 ? [{ rotulo: "Precisa vender", valor: <><Num v={Math.ceil(requiredPace as number)} /> por dia{lote ? ateLote : " até o evento"}</> }] : []),
          { rotulo: "Vendendo", valor: <><Num v={currentPace} /> por dia{calc.ant && calc.rAnt !== null ? <span className="font-normal text-muted-foreground"> · {calc.ant.name}: <Num v={calc.rAnt} /></span> : null}</> },
          { rotulo: "Últimos 7 dias", valor: <><Num v={calc.semana.ritmo ?? 0} /> por dia</> },
        ]
      : visao === "lote"
      ? !lote
        ? [{ rotulo: emPeriodo ? "No período" : "Escolha um lote", valor: emPeriodo ? <><Num v={vendidosRecorte} /> vendidos</> : "na caixa acima" }]
        : calc.metaLote === null
        ? [{ rotulo: "Meta do lote", valor: "não definida (aba Metas)" }]
        : [
            { rotulo: "Faltam", valor: calc.n.faltam > 0 ? <><Num v={calc.n.faltam} /> ingressos{ateLote}</> : "meta batida" },
            ...(projecao !== null && calc.n.faltam > 0 ? [{ rotulo: "Nesse ritmo", valor: <>termina com cerca de <Num v={projecao} /></> }] : []),
          ]
      : metaEvento === null
      ? [{ rotulo: "Meta do evento", valor: "não definida (aba Metas)" }]
      : [
          { rotulo: "Faltam", valor: calc.nEvento.faltam > 0 ? <><Num v={calc.nEvento.faltam} /> ingressos até o evento</> : "meta batida" },
          ...(calc.nEvento.necessario !== null && calc.nEvento.faltam > 0 ? [{ rotulo: "Precisa vender", valor: <><Num v={Math.ceil(calc.nEvento.necessario)} /> por dia</> }] : []),
        ];
  const marcaIn2 = point(gMarcaFrac, R - 14);
  const marcaOut2 = point(gMarcaFrac, R + 14);
  const rot = g.marca ? rotuloDoMarcador(gMarcaFrac, g.marca.titulo, g.marca.valor) : null;

  return (
    <Card className={cn("flex flex-col gap-3 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
          Ritmo de vendas <InfoTip title="Ritmo de vendas" />
        </div>
        <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)}>
          <SlidingTabsList value={visao} className="h-9">
            {(["dia", "lote", "evento"] as const).map((v) => (
              <TabsTrigger key={v} value={v} className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
                {v === "dia" ? "Dia" : v === "lote" ? "Lote" : "Evento"}
              </TabsTrigger>
            ))}
          </SlidingTabsList>
        </Tabs>
      </div>
      {visao !== "evento" && (
        <Select value={selecao} onValueChange={setEscolha}>
          <SelectTrigger className="h-9 w-full max-w-[240px] text-xs" aria-label="Recorte do ritmo"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodo && <SelectItem value={PERIODO}>Período filtrado · {ddmm(periodo.inicio)} a {ddmm(periodo.fim)}</SelectItem>}
            {lista.map((o) => <SelectItem key={o.name} value={o.name}>{o.name}{o.name === vigente ? " (vigente)" : ""}</SelectItem>)}
            <SelectItem value={EVENTO}>Evento todo</SelectItem>
          </SelectContent>
        </Select>
      )}
      {faltaData && <AvisoDatas compacto />}
      {visao === "dia" && alerta && cobre !== null && (
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
        <svg viewBox={`${GAUGE.vb.x} ${GAUGE.vb.y} ${GAUGE.vb.w} ${GAUGE.vb.h}`} className="mx-auto h-auto w-full max-w-[268px] shrink-0" role="img" aria-label={`${int(g.valor)} ${g.legenda}; escala de 0 a ${fmt(escala.maximo)}${g.marca ? `; ${g.marca.titulo} ${g.marca.valor}` : ""}`}>
          <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="hsl(var(--secondary))" strokeWidth="16" strokeLinecap="round" />
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={gCor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-[1200ms] ease-cupola motion-reduce:transition-none"
          />
          {g.marca && rot && (
            <>
              <line x1={marcaIn2.x} y1={marcaIn2.y} x2={marcaOut2.x} y2={marcaOut2.y} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
              <text x={rot.x} y={rot.baselines.titulo} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {g.marca.titulo}
              </text>
              <text x={rot.x} y={rot.baselines.valor} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">
                {g.marca.valor}
              </text>
            </>
          )}
          <text x={CX} y={CY - 22} textAnchor="middle" className={cn("cursor-help text-[30px] tracking-[-0.035em]", visao === "dia" && cor === "bad" ? "fill-bad" : visao === "dia" && cor === "warn" ? "fill-warn" : "fill-foreground")} style={{ fontWeight: 600 }}>
            <title>{exato(g.valor)}</title>
            {int(g.valor)}
          </text>
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {g.legenda}
          </text>
          <text x={CX - R} y={CY + 22} textAnchor="middle" className="fill-muted-foreground text-[9px]">0</text>
          <text x={CX + R} y={CY + 22} textAnchor="middle" className="fill-muted-foreground text-[9px]">{fmt(escala.maximo)}</text>
        </svg>
        <dl className="flex min-w-0 flex-col divide-y divide-border border-t border-border text-sm">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="shrink-0 text-xs text-muted-foreground">{l.rotulo}</dt>
              <dd className="min-w-0 text-right font-medium tabular-nums">{l.valor}</dd>
            </div>
          ))}
        </dl>
        {visao === "dia" && !lote && !emPeriodo && <CompareLine anterior={ritmoAnterior} atual={currentPace} formato={(n) => `${int(n)}/dia`} quando="nesta época" />}
      </div>
    </Card>
  );
}

type Visao = "dia" | "lote" | "evento";

// Número inteiro à vista (não existe meio ingresso); o valor exato aparece ao passar o mouse.
const exato = (n: number) => `Valor exato: ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
function Num({ v }: { v: number }) {
  return <span title={Number.isInteger(v) ? undefined : exato(v)} className={Number.isInteger(v) ? undefined : "cursor-help"}>{int(v)}</span>;
}
