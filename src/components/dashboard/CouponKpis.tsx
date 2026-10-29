// KPIs de cupons e o cálculo dos totais, compartilhados entre a página Cupons e a aba Comercial do
// dashboard. Os dois lugares usam a MESMA função, então os números são espelhados e nunca divergem.
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/InfoTip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { couponDiscountValue, parseCoupon } from "@/lib/coupons";

export interface CouponTotals {
  // Ingressos com cupom de 100% (cortesia via cupom).
  gratuitos: number;
  // Soma em R$ dos descontos concedidos (só cupons menores que 100%).
  descontos: number;
  // Códigos de cupom diferentes usados.
  cuponsUsados: number;
  // Ingressos que vieram com qualquer cupom.
  comCupom: number;
}

export function useCouponTotals(tickets: Ticket[]): CouponTotals {
  return useMemo(() => {
    const { paying, bonus } = splitTickets(tickets);
    const map = new Map<string, { uses: number; kind: "faturado" | "cortesia" | "desconto"; desconto: number }>();
    [...paying, ...bonus].forEach((t) => {
      const c = parseCoupon(t.coupon_code);
      if (!c) return;
      const atual = map.get(c.code) ?? { uses: 0, kind: c.kind, desconto: 0 };
      atual.uses += t.quantity || 0;
      atual.desconto += couponDiscountValue(t);
      map.set(c.code, atual);
    });
    const linhas = Array.from(map.values());
    return {
      gratuitos: linhas.filter((c) => c.kind === "cortesia").reduce((s, c) => s + c.uses, 0),
      descontos: linhas.reduce((s, c) => s + c.desconto, 0),
      cuponsUsados: linhas.length,
      comCupom: linhas.reduce((s, c) => s + c.uses, 0),
    };
  }, [tickets]);
}

export function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Mesmo visual do KPI da página Cupons.
export function Kpi({ title, value, hint, className }: { title: string; value: string; hint?: string; className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          {title} <InfoTip title={title} />
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.035em] tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
