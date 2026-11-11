import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { COUNTS_ON_GOAL, ticketCategory, type TicketCategory } from "@/lib/ticketCategory";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { cn } from "@/lib/utils";
import { isCancelled } from "@/lib/eventConfig";
import { GoalMeter } from "@/components/GoalMeter";
import { CompareLine } from "@/components/CompareLine";
import { DIAS_PARA_CONFERIR, pendingPayments } from "@/lib/pendingPayments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { batchOf, lotesParaLista } from "@/lib/batches";

// Recorte "evento todo" do filtro de lote (compartilhado com o card Vendas por tipo de ingresso).
export const LOTE_EVENTO = "__evento";
const EVENTO = LOTE_EVENTO;

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%");

// Ordem da legenda: primeiro o que conta na meta, depois os bonificados e os pendentes.
const CATEGORIAS: { key: TicketCategory; label: string; color: string }[] = [
  { key: "pagos", label: "Pagos na Sympla", color: "hsl(var(--chart-1))" },
  { key: "faturados", label: "Faturados internamente", color: "hsl(var(--chart-2))" },
  { key: "cortesias", label: "Cortesias e bonificados", color: "hsl(var(--chart-5))" },
  { key: "credenciais", label: "Credenciais", color: "hsl(var(--muted-foreground))" },
  { key: "gratuitos", label: "Gratuitos sem cupom", color: "hsl(var(--chart-3))" },
  { key: "pendentes", label: "Pendentes", color: "hsl(var(--warn))" },
];

const qty = (t: Ticket) => t.quantity || 0;

interface Fatia {
  key: string;
  label: string;
  value: number;
  color: string;
  meta?: boolean;
}

function porCategoria(todos: Ticket[]): Fatia[] {
  const tickets = todos.filter((t) => !isCancelled(t.status));
  const soma: Record<string, number> = {};
  tickets.forEach((t) => {
    const cat = ticketCategory(t);
    soma[cat] = (soma[cat] || 0) + qty(t);
  });
  return CATEGORIAS.map((c) => ({ key: c.key, label: c.label, value: soma[c.key] || 0, color: c.color, meta: COUNTS_ON_GOAL.includes(c.key) })).filter((f) => f.value > 0);
}


// Faturados internos: quanto já foi resgatado na Sympla e o que ainda está aberto no CRM, por etapa do funil.
// Os abertos não contam na meta: só aparecem para acompanhar o que está para entrar.
function FaturadosNoCrm({ tickets }: { tickets: Ticket[] }) {
  const ganhos = tickets.filter((t) => ticketCategory(t) === "faturados").reduce((s, t) => s + qty(t), 0);
  const resgatados = tickets.filter((t) => ticketCategory(t) === "resgates").reduce((s, t) => s + qty(t), 0);
  const abertos = tickets.filter((t) => ticketCategory(t) === "negociacao");
  const parcelados = new Set(tickets.filter((t) => ticketCategory(t) === "faturados" && t.installments).map((t) => t.deal_id)).size;
  const conferir = new Set(tickets.filter((t) => t.source === "pipedrive" && t.conferir).map((t) => t.deal_id)).size;
  // Negócios ganhos com a quantidade de ingressos, cada um com o link para o negócio no Pipedrive.
  const negociosGanhos = new Map<string, { nome: string; ingressos: number; link: string | null }>();
  tickets
    .filter((t) => t.source === "pipedrive" && t.status === "approved" && t.deal_id)
    .forEach((t) => {
      const n = negociosGanhos.get(t.deal_id!) ?? { nome: t.company || t.deal_title || `Negócio ${t.deal_id}`, ingressos: 0, link: t.crm_account ? `https://${t.crm_account}.pipedrive.com/deal/${t.deal_id}` : null };
      n.ingressos += qty(t);
      negociosGanhos.set(t.deal_id!, n);
    });
  if (!ganhos && !abertos.length) return null;
  const etapas = new Map<string, { ingressos: number; negocios: Set<string> }>();
  abertos.forEach((t) => {
    const e = etapas.get(t.stage_name || "Sem etapa") ?? { ingressos: 0, negocios: new Set<string>() };
    e.ingressos += qty(t);
    e.negocios.add(t.deal_id ?? "");
    etapas.set(t.stage_name || "Sem etapa", e);
  });
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed px-3 py-2.5 text-xs md:col-span-2">
      {ganhos > 0 && (
        <p>
          <b className="font-semibold">Faturados internamente:</b> {int(ganhos)} ganhos no CRM, {int(resgatados)} já resgatados na Sympla.{" "}
          <span className="text-muted-foreground">
            Ganho = contrato assinado ou primeira parcela paga.{parcelados > 0 && ` ${parcelados} ${parcelados === 1 ? "negócio parcelado" : "negócios parcelados"}.`}
          </span>
        </p>
      )}
      {negociosGanhos.size > 0 && (
        <p className="text-muted-foreground">
          {Array.from(negociosGanhos.values()).map((n, i) => (
            <span key={n.nome + i}>
              {i > 0 && " · "}
              {n.link ? (
                <a href={n.link} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                  {n.nome}
                </a>
              ) : n.nome}{" "}
              ({int(n.ingressos)})
            </span>
          ))}
        </p>
      )}
      {abertos.length > 0 && (
        <p className="text-muted-foreground">
          <b className="font-semibold text-foreground">Faturamento em andamento (não conta ainda):</b>{" "}
          {Array.from(etapas.entries()).map(([etapa, e]) => `${etapa}: ${int(e.ingressos)} ${e.ingressos === 1 ? "ingresso" : "ingressos"} (${e.negocios.size} ${e.negocios.size === 1 ? "negócio" : "negócios"})`).join(" · ")}
        </p>
      )}
      {conferir > 0 && <p className="text-warn">Para investigar no CRM: {conferir} {conferir === 1 ? "negócio" : "negócios"} com quantidade lida pelo título ou corrigida.</p>}
    </div>
  );
}

// Vendas da Sympla aguardando pagamento: não contam ainda. Pendente antigo pode já estar pago (a API da Sympla não
// atualiza o status do boleto ou pix compensado depois), então vai para conferência na Sympla.
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
function AguardandoPagamento({ rows }: { rows: { order_data: any }[] }) {
  const { pedidos, valor, paraConferir } = useMemo(() => pendingPayments(rows), [rows]);
  if (!pedidos.length) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed px-3 py-2.5 text-xs md:col-span-2">
      <p className="text-muted-foreground">
        <b className="font-semibold text-foreground">Aguardando pagamento na Sympla (não conta ainda):</b> {int(pedidos.length)}{" "}
        {pedidos.length === 1 ? "pedido" : "pedidos"}, {brl(valor)}. Entra quando o pagamento for aprovado e sai se for cancelado.
      </p>
      {paraConferir.length > 0 && (
        <p className="text-warn">
          Para conferir na Sympla: {paraConferir.map((p) => `${p.id} (há ${p.dias} dias)`).join(" · ")}. Pendente há mais de{" "}
          {DIAS_PARA_CONFERIR} dias pode já ter sido pago, e a Sympla não avisa o painel.
        </p>
      )}
    </div>
  );
}

// Fatia em destaque no hover: engrossa um pouco, como no ds-summit.
function FatiaAtiva(props: any) {
  return <Sector {...props} outerRadius={props.outerRadius + 6} />;
}

// Todos os ingressos emitidos do evento numa pizza: pagos, faturados, cortesias, credenciais e pendentes (o que conta na
// meta). O tipo de ingresso vendido (Padrão, VIP, Combo, Grupo) fica no card Vendas por tipo de ingresso, logo depois.
// Meta de ingressos emitidos (opcional, da tela Metas): aparece embaixo da pizza.
type MetaEmitidos = { target_value: number | string; period_start: string; period_end: string } | null;

export function IssuedTicketsCard({
  tickets,
  goal,
  emitidosAnterior,
  emitidosAtual,
  quando = "na mesma data (aprovados)",
  aguardando = [],
  recorte: recorteControlado,
  onRecorte,
  className,
}: {
  // Filtro de lote controlado de fora, para valer também no card Vendas por tipo de ingresso.
  recorte?: string;
  onRecorte?: (v: string) => void;
  // Pedidos da Sympla sem ingresso gravado, para o aviso de vendas aguardando pagamento.
  aguardando?: { order_data: any }[];
  tickets: Ticket[];
  goal?: MetaEmitidos;
  // Ingressos aprovados (pagos, faturados e cortesias) até hoje e no evento anterior na mesma data.
  emitidosAnterior?: number | null;
  emitidosAtual?: number;
  // Texto da comparação: "na mesma data" no evento inteiro, "no mesmo período" com filtro.
  quando?: string;
  className?: string;
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  // Recorte por lote (Pré-venda, Lote 0…). Comparação, meta de emitidos e pendentes são do evento todo: só sem recorte.
  const [recorteLocal, setRecorteLocal] = useState(EVENTO);
  const recorte = recorteControlado ?? recorteLocal;
  const setRecorte = onRecorte ?? setRecorteLocal;
  const lotes = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => { const b = batchOf(t.ticket_type); if (b) s.add(b); });
    return lotesParaLista(Array.from(s));
  }, [tickets]);
  const lote = recorte === EVENTO || !lotes.includes(recorte) ? null : recorte;
  const doLote = useMemo(() => (lote ? tickets.filter((t) => batchOf(t.ticket_type) === lote) : tickets), [tickets, lote]);

  const fatias = useMemo(() => porCategoria(doLote), [doLote]);
  const total = fatias.reduce((s, f) => s + f.value, 0);
  const destaque = ativa != null ? fatias[ativa] : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Ingressos emitidos <InfoTip title="Ingressos emitidos" />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Pagos, faturados e cortesias: o que conta na meta</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {lotes.length > 1 && (
          <Select value={lote ?? EVENTO} onValueChange={(v) => { setRecorte(v); setAtiva(null); }}>
            <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {lotes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              <SelectItem value={EVENTO}>Evento todo</SelectItem>
            </SelectContent>
          </Select>
        )}
        </div>
      </CardHeader>
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
            const grupo = fatias.map((f, i) => ({ f, i })).filter(({ f }) => !!f.meta === contaMeta);
            if (grupo.length === 0) return null;
            const subtotal = grupo.reduce((s, { f }) => s + f.value, 0);
            return (
              <div key={String(contaMeta)}>
                {(
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
        <FaturadosNoCrm tickets={doLote} />
        {!lote && <AguardandoPagamento rows={aguardando} />}
        {!lote && <CompareLine className="md:col-span-2" anterior={emitidosAnterior} atual={emitidosAtual ?? 0} quando={quando} />}
        {!lote && goal && Number(goal.target_value) > 0 && (
          <GoalMeter
            className="md:col-span-2"
            actual={fatias.reduce((s, f) => s + f.value, 0)}
            target={Number(goal.target_value)}
            periodStart={goal.period_start}
            periodEnd={goal.period_end}
          />
        )}
      </CardContent>
    </Card>
  );
}
