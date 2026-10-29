// Preço cheio do lote e descontos da aba Comercial (com cortesias valorizadas pelo preço cheio).
import { batchOf } from "@/lib/batches";
import { couponDiscountValue, parseCoupon } from "@/lib/coupons";

interface T {
  quantity?: number | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  coupon_code?: string | null;
  ticket_type?: string | null;
}

// Valor mais comum entre os preços (moda); empate fica com o maior.
function moda(valores: number[]): number | null {
  const m = new Map<number, number>();
  valores.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  const [melhor] = Array.from(m.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  return melhor ? melhor[0] : null;
}

// Preço cheio: o valor unitário mais comum dos ingressos vendidos sem cupom, por tipo exato e por lote.
export function fullPrices(tickets: T[]) {
  const porTipo = new Map<string, number[]>();
  const porLote = new Map<string, number[]>();
  tickets.forEach((t) => {
    const preco = Number(t.unit_price || 0);
    if (!(preco > 0) || parseCoupon(t.coupon_code)) return;
    if (t.ticket_type) porTipo.set(t.ticket_type, [...(porTipo.get(t.ticket_type) ?? []), preco]);
    const lote = batchOf(t.ticket_type);
    if (lote) porLote.set(lote, [...(porLote.get(lote) ?? []), preco]);
  });
  const tipo = new Map(Array.from(porTipo.entries()).map(([k, v]) => [k, moda(v) as number]));
  const lote = new Map(Array.from(porLote.entries()).map(([k, v]) => [k, moda(v) as number]));
  return {
    byBatch: lote,
    priceOf: (t: T): number => (t.ticket_type && tipo.get(t.ticket_type)) || lote.get(batchOf(t.ticket_type) ?? "") || 0,
  };
}

// Descontos concedidos (Comercial): cupons parciais pela diferença + cortesias (cupom 100%) pelo preço cheio do lote.
// Receita bruta = receita paga + descontos. `priceSource` serve para achar o preço cheio (todas as vendas do evento).
export function commercialDiscounts(couponTickets: T[], revenue: number, priceSource: T[] = couponTickets) {
  const { priceOf } = fullPrices(priceSource);
  let total = 0;
  couponTickets.forEach((t) => {
    const c = parseCoupon(t.coupon_code);
    if (!c) return;
    if (c.kind === "cortesia") total += priceOf(t) * (t.quantity || 1);
    else total += couponDiscountValue(t);
  });
  total = Math.round(total * 100) / 100;
  const bruta = revenue + total;
  return { total, bruta, pct: bruta > 0 ? total / bruta : 0 };
}
