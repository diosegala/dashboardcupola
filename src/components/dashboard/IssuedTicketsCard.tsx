import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "./SlidingTabsList";
import { parseCoupon } from "@/lib/coupons";
import { isApproved } from "@/lib/eventConfig";
import { TICKET_KINDS, ticketKind, type TicketKind } from "@/lib/ticketKinds";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%");

// Pagos e faturados contam na meta; cortesias e gratuitos são bonificados (tons neutros); pendentes ainda não contam.
const CATEGORIAS = [
  { key: "pagos", label: "Pagos na Sympla", color: "hsl(var(--chart-1))", meta: true },
  { key: "faturados", label: "Faturados internamente", color: "hsl(var(--chart-2))", meta: true },
  { key: "cortesias", label: "Cortesias com cupom", color: "hsl(var(--chart-5))", meta: false },
  { key: "gratuitos", label: "Gratuitos sem cupom", color: "hsl(var(--chart-3))", meta: false },
  { key: "pendentes", label: "Pendentes", color: "hsl(var(--warn))", meta: false },
] as const;

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
const price = (t: Ticket) => Number(t.unit_price ?? t.total_price ?? 0);

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
    let cat: string;
    if (!isApproved(t.status)) cat = "pendentes";
    else if (parseCoupon(t.coupon_code)?.kind === "faturado") cat = "faturados";
    else if (price(t) > 0) cat = "pagos";
    else cat = t.coupon_code ? "cortesias" : "gratuitos";
    soma[cat] = (soma[cat] || 0) + qty(t);
  });
  return CATEGORIAS.map((c) => ({ key: c.key, label: c.label, value: soma[c.key] || 0, color: c.color, meta: c.meta })).filter((f) => f.value > 0);
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
export function IssuedTicketsCard({ tickets, className }: { tickets: Ticket[]; className?: string }) {
  const [visao, setVisao] = useState<"categoria" | "lote">("categoria");
  const [ativa, setAtiva] = useState<number | null>(null);

  const fatias = useMemo(() => (visao === "categoria" ? porCategoria(tickets) : porTipo(tickets)), [tickets, visao]);
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
        <Tabs value={visao} onValueChange={(v) => { setVisao(v as "categoria" | "lote"); setAtiva(null); }}>
          <SlidingTabsList value={visao} className="h-9">
            <TabsTrigger value="categoria" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              Por categoria
            </TabsTrigger>
            <TabsTrigger value="lote" className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              Por tipo de ingresso
            </TabsTrigger>
          </SlidingTabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="relative mx-auto h-[220px] w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fatias}
                dataKey="value"
                nameKey="label"
                innerRadius="64%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="none"
                animationDuration={1000}
                activeIndex={ativa ?? undefined}
                activeShape={FatiaAtiva}
                onMouseEnter={(_, i) => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
              >
                {fatias.map((f, i) => (
                  <Cell key={f.key} fill={f.color} opacity={ativa != null && ativa !== i ? 0.35 : 1} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 }}
                formatter={(v: number, n: string) => [`${int(v)} (${pct(v, total)})`, n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-2xl font-semibold tracking-[-0.035em]">{int(destaque ? destaque.value : total)}</div>
              <div className="max-w-[110px] text-xs text-muted-foreground">{destaque ? destaque.label : "ingressos emitidos"}</div>
            </div>
          </div>
        </div>

        <ul className="space-y-1.5">
          {fatias.map((f, i) => (
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
      </CardContent>
    </Card>
  );
}
