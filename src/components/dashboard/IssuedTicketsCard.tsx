import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "./SlidingTabsList";
import { COUNTS_ON_GOAL, ticketCategory, type TicketCategory } from "@/lib/ticketCategory";
import { SalesSection } from "./SalesSection";
import { TICKET_KINDS, ticketKind, type TicketKind } from "@/lib/ticketKinds";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { cn } from "@/lib/utils";
import { GoalMeter } from "@/components/GoalMeter";
import { CompareLine } from "@/components/CompareLine";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%");

// Ordem da legenda: primeiro o que conta na meta, depois os bonificados e os pendentes.
const CATEGORIAS: { key: TicketCategory; label: string; color: string }[] = [
  { key: "pagos", label: "Pagos na Sympla", color: "hsl(var(--chart-1))" },
  { key: "desconto", label: "Pagos com desconto", color: "hsl(var(--chart-4))" },
  { key: "faturados", label: "Faturados internamente", color: "hsl(var(--chart-2))" },
  { key: "cortesias", label: "Cortesias (cupom 100%)", color: "hsl(var(--chart-5))" },
  { key: "credenciais", label: "Credenciais", color: "hsl(var(--muted-foreground))" },
  { key: "gratuitos", label: "Gratuitos sem cupom", color: "hsl(var(--chart-3))" },
  { key: "pendentes", label: "Pendentes", color: "hsl(var(--warn))" },
];

// Cores fixas por tipo: azul e lima para os principais, tons neutros para o resto.
const COR_TIPO: Record<TicketKind, string> = {
  Padrão: "hsl(var(--chart-1))",
  VIP: "hsl(var(--chart-2))",
  "Padrão Combo": "hsl(var(--chart-4))",
  "VIP Combo": "hsl(var(--accent-text))",
  Grupo: "hsl(var(--chart-3))",
  "Visita presencial": "hsl(var(--chart-5))",
  Credenciais: "hsl(var(--muted-foreground))",
};

const qty = (t: Ticket) => t.quantity || 0;

interface Fatia {
  key: string;
  label: string;
  value: number;
  color: string;
  meta?: boolean;
}

function porCategoria(tickets: Ticket[]): Fatia[] {
  const soma: Record<string, number> = {};
  tickets.forEach((t) => {
    const cat = ticketCategory(t);
    soma[cat] = (soma[cat] || 0) + qty(t);
  });
  return CATEGORIAS.map((c) => ({ key: c.key, label: c.label, value: soma[c.key] || 0, color: c.color, meta: COUNTS_ON_GOAL.includes(c.key) })).filter((f) => f.value > 0);
}

// Agrupa pelo tipo (Padrão, VIP, combos, grupo...), não pelo nome de cada lote.
function porTipo(tickets: Ticket[]): Fatia[] {
  const soma = new Map<TicketKind, number>();
  tickets.forEach((t) => {
    const tipo = ticketKind(t.ticket_type);
    soma.set(tipo, (soma.get(tipo) || 0) + qty(t));
  });
  return TICKET_KINDS.filter((k) => soma.get(k)).map((k) => ({ key: k, label: k, value: soma.get(k) as number, color: COR_TIPO[k] }));
}

// Fatia em destaque no hover: engrossa um pouco, como no ds-summit.
function FatiaAtiva(props: any) {
  return <Sector {...props} outerRadius={props.outerRadius + 6} />;
}

// Todos os ingressos emitidos do evento, numa pizza só: por categoria (o que conta na meta) ou por tipo de ingresso da Sympla.
// Meta de ingressos emitidos (opcional, da tela Metas): aparece embaixo da pizza.
type MetaEmitidos = { target_value: number | string; period_start: string; period_end: string } | null;

export function IssuedTicketsCard({
  tickets,
  goal,
  emitidosAnterior,
  emitidosAtual,
  className,
  goals = [],
  allTimeTickets = [],
  previousYearTickets = [],
}: {
  tickets: Ticket[];
  goals?: any[];
  allTimeTickets?: Ticket[];
  previousYearTickets?: Ticket[];
  goal?: MetaEmitidos;
  // Ingressos aprovados (pagos, faturados e cortesias) até hoje e no evento anterior na mesma data.
  emitidosAnterior?: number | null;
  emitidosAtual?: number;
  className?: string;
}) {
  const [visao, setVisao] = useState<"categoria" | "tipo" | "lote">("categoria");
  const [ativa, setAtiva] = useState<number | null>(null);

  const fatias = useMemo(() => (visao === "categoria" ? porCategoria(tickets) : visao === "tipo" ? porTipo(tickets) : []), [tickets, visao]);
  const total = fatias.reduce((s, f) => s + f.value, 0);
  const destaque = ativa != null ? fatias[ativa] : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Ingressos emitidos <InfoTip title="Ingressos emitidos" />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Todos os ingressos do evento e quanto cada parte representa</p>
        </div>
        <Tabs value={visao} onValueChange={(v) => { setVisao(v as "categoria" | "tipo" | "lote"); setAtiva(null); }}>
          <SlidingTabsList value={visao} className="h-9 max-w-full overflow-x-auto">
            <TabsTrigger value="categoria" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              Por categoria
            </TabsTrigger>
            <TabsTrigger value="tipo" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              Por tipo
            </TabsTrigger>
            <TabsTrigger value="lote" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              Por lote
            </TabsTrigger>
          </SlidingTabsList>
        </Tabs>
      </CardHeader>
      {visao === "lote" ? (
        <CardContent>
          <SalesSection embedded goals={goals} allTimeTickets={allTimeTickets} previousYearTickets={previousYearTickets} />
        </CardContent>
      ) : (
      <CardContent className="grid items-center gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fatias}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="84%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
                activeIndex={ativa ?? undefined}
                activeShape={FatiaAtiva}
                onMouseEnter={(_, i) => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
              >
                {fatias.map((f, i) => (
                  <Cell key={f.key} fill={f.color} opacity={ativa != null && ativa !== i ? 0.35 : 1} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-xl font-semibold leading-none tracking-[-0.035em]">{int(destaque ? destaque.value : total)}</div>
              <div className="mx-auto mt-1 max-w-[84px] text-[10px] leading-tight text-muted-foreground">{destaque ? destaque.label : <>ingressos<br />emitidos</>}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          {[true, false].map((contaMeta) => {
            const grupo = fatias.map((f, i) => ({ f, i })).filter(({ f }) => (visao === "categoria" ? !!f.meta === contaMeta : contaMeta));
            if (grupo.length === 0) return null;
            const subtotal = grupo.reduce((s, { f }) => s + f.value, 0);
            return (
              <div key={String(contaMeta)}>
                {visao === "categoria" && (
                  <div className="mb-1 flex justify-between px-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>{contaMeta ? "Contam na meta" : "Não contam na meta"}</span>
                    <span className="tabular-nums">{int(subtotal)}</span>
                  </div>
                )}
                <ul className="space-y-0.5">
                  {grupo.map(({ f, i }) => (
                    <li
                      key={f.key}
                      onMouseEnter={() => setAtiva(i)}
                      onMouseLeave={() => setAtiva(null)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-[13px] transition-[background-color,opacity] duration-150 hover:bg-secondary",
                        ativa != null && ativa !== i && "opacity-45",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: f.color }} />
                        <span className="truncate">{f.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <b className="font-semibold">{int(f.value)}</b>
                        <span className="ml-2 text-muted-foreground">{pct(f.value, total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <CompareLine className="md:col-span-2" anterior={emitidosAnterior} atual={emitidosAtual ?? 0} quando="na mesma data (aprovados)" />
        {goal && Number(goal.target_value) > 0 && (
          <GoalMeter
            className="md:col-span-2"
            actual={fatias.reduce((s, f) => s + f.value, 0)}
            target={Number(goal.target_value)}
            periodStart={goal.period_start}
            periodEnd={goal.period_end}
          />
        )}
      </CardContent>
      )}
    </Card>
  );
}
