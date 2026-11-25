// Descontos da aba Comercial. O preço de tabela de cada lote vem só do cadastro (lotPricing).
import { couponDiscountValue } from "@/lib/coupons";

interface T {
  quantity?: number | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  coupon_code?: string | null;
  ticket_type?: string | null;
}

// Descontos concedidos (Comercial): só cupons de desconto parcial (preço cheio − valor pago).
// Cupons de 100% não entram (podem ser resgates de compras faturadas internamente).
// Receita bruta = receita paga + descontos.
export function commercialDiscounts(couponTickets: T[], revenue: number) {
  // Faturados internos: desconto do produto no Pipedrive, quando preenchido.
  const total = Math.round(couponTickets.reduce((s, t: any) => s + couponDiscountValue(t) + (t.discount_value || 0), 0) * 100) / 100;
  const bruta = revenue + total;
  return { total, bruta, pct: bruta > 0 ? total / bruta : 0 };
}
