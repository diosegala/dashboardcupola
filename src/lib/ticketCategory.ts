import { parseCoupon } from "@/lib/coupons";
import { isApproved } from "@/lib/eventConfig";
import { ticketKind } from "@/lib/ticketKinds";

export type TicketCategory = "pagos" | "desconto" | "faturados" | "cortesias" | "credenciais" | "gratuitos" | "pendentes";

// Categorias que contam na meta de pagantes.
export const COUNTS_ON_GOAL: TicketCategory[] = ["pagos", "desconto", "faturados"];

type T = { status?: string | null; coupon_code?: string | null; ticket_type?: string | null; unit_price?: number | string | null; total_price?: number | string | null };

// Ordem de decisão: pendente > faturado > cortesia (cupom 100%) > credencial > pago (com/sem desconto) > gratuito.
export function ticketCategory(t: T): TicketCategory {
  if (!isApproved(t.status ?? "")) return "pendentes";
  const cupom = parseCoupon(t.coupon_code);
  if (cupom?.kind === "faturado") return "faturados";
  if (cupom?.kind === "cortesia") return "cortesias";
  if (ticketKind(t.ticket_type ?? "") === "Credenciais") return "credenciais";
  const preco = Number(t.unit_price ?? t.total_price ?? 0);
  if (preco > 0) return cupom ? "desconto" : "pagos";
  return cupom ? "cortesias" : "gratuitos";
}
