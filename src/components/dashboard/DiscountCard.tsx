import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { useEvent } from "@/hooks/useEvent";
import { useEventBatches } from "@/hooks/useEventBatches";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { descontoPonderado, descontoSimples, resumoDesconto, type Soma, type VendaDesconto } from "@/lib/lotPricing";

const TITULO = "Desconto médio";
const pctTxt = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Desconto médio frente à tabela oficial do lote: total, Sympla, faturado e por lote. Segue o período do topo.
export function DiscountCard({ tickets, className }: { tickets: Ticket[]; className?: string }) {
  const { event } = useEvent();
  const { data: lotes = [] } = useEventBatches();
  // Valor do comprador por ingresso (só esse campo, liberado para todo o painel).
  const precos = useQuery({
    queryKey: ["valor-comprador", event.sympla_event_id],
    enabled: !!event.sympla_event_id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_buyer_prices", { p_event_id: event.sympla_event_id });
      if (error) throw error;
      return new Map<string, number>(((data ?? []) as any[]).filter((r) => r.ticket_sale_price != null).map((r) => [String(r.sympla_order_id), Number(r.ticket_sale_price)]));
    },
  });
  const preVenda = useQuery({
    queryKey: ["preco-pre-venda", event.id],
    enabled: !!event.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("events").select("presale_price").eq("id", event.id).maybeSingle();
      return data?.presale_price != null ? Number(data.presale_price) : null;
    },
  });

  const r = useMemo(() => {
    const { paying, visits } = splitTickets(tickets);
    const vendas: VendaDesconto[] = [...paying, ...visits].map((t) => {
      const q = t.quantity || 0;
      if (t.source === "pipedrive") return { produto: t.ticket_type, quantidade: q, pago: Number(t.total_price || 0), fonte: "pipedrive" };
      const unit = precos.data?.get(String(t.sympla_order_id));
      return { produto: t.ticket_type, quantidade: q, pago: unit != null ? unit * q : null, fonte: "sympla" };
    });
    const doEvento = lotes.filter((l) => l.event_id === event.id) as any[];
    return resumoDesconto(vendas, doEvento, preVenda.data);
  }, [tickets, precos.data, lotes, event.id, preVenda.data]);

  if (!precos.data || r.total.vendas === 0) return null;
  const linha = (rotulo: string, s: Soma) => (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="tabular-nums"><b className="font-semibold">{pctTxt(descontoPonderado(s))}</b> <span className="text-xs text-muted-foreground">· {brl(s.cheio - s.pago)} em {s.vendas} vendas</span></span>
    </div>
  );
  const maior = Math.max(...r.porLote.map((l) => descontoPonderado(l.soma) ?? 0), 0.01);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">{TITULO} <InfoTip title={TITULO} /></CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Quanto as vendas ficaram abaixo da tabela oficial do lote</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="text-4xl font-semibold tabular-nums">{pctTxt(descontoPonderado(r.total))}</div>
            <p className="text-xs text-muted-foreground">
              {brl(r.total.cheio - r.total.pago)} abaixo da tabela · média simples {pctTxt(descontoSimples(r.total))}
            </p>
          </div>
          {linha("Sympla", r.sympla)}
          {linha("Faturado", r.faturado)}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Por lote</p>
          {r.porLote.map(({ lote, soma }) => {
            const d = descontoPonderado(soma) ?? 0;
            return (
              <div key={lote} className="grid grid-cols-[80px_1fr_56px] items-center gap-2 text-sm">
                <span>{lote}</span>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(d, 0) / maior * 100}%` }} /></div>
                <span className="text-right tabular-nums">{pctTxt(d)}</span>
              </div>
            );
          })}
        </div>
        {r.semReferencia.length > 0 && (
          <div role="alert" className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs lg:col-span-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="font-semibold">Fora do cálculo:</b>{" "}
              {r.semReferencia.map((s) => `"${s.nome}" (${s.quantidade}) — ${s.motivo}`).join("; ")}. Avise o administrador.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
