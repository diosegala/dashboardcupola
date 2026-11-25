import { parseCoupon } from "@/lib/coupons";
import { isApproved } from "@/lib/eventConfig";
import { ticketKind } from "@/lib/ticketKinds";

export type TicketCategory = "pagos" | "faturados" | "cortesias" | "credenciais" | "gratuitos" | "pendentes" | "resgates" | "negociacao" | "visitas";

// Categorias que contam na meta de pagantes.
export const COUNTS_ON_GOAL: TicketCategory[] = ["pagos", "faturados"];

type T = { source?: string; bonus?: boolean; redeems?: string | null; status?: string | null; coupon_code?: string | null; ticket_type?: string | null; unit_price?: number | string | null; total_price?: number | string | null };

// Ordem de decisão: faturado (Pipedrive) > pendente > resgate de faturado > cortesia (cupom 100%) > credencial > pago > gratuito.
// O ingresso faturado conta pelo negócio ganho no Pipedrive. O resgate na Sympla com cupom FATURADO só dá baixa
// no saldo do comprador: não é venda, senão o mesmo ingresso contaria duas vezes (decisão de 28/10/2026).
export function ticketCategory(t: T): TicketCategory {
  // Negócio aberto no CRM (negociação, fechamento): aparece à parte, não conta como venda.
  // Visita avulsa paga: não dá acesso ao evento, então fica fora de pagantes, meta, ritmo e pessoas (a receita conta).
  const visita = ticketKind(t.ticket_type ?? "") === "Visita presencial";
  if (t.source === "pipedrive") return !isApproved(t.status ?? "") ? "negociacao" : t.bonus ? "cortesias" : visita ? "visitas" : "faturados";
  if (!isApproved(t.status ?? "")) return "pendentes";
  const cupom = parseCoupon(t.coupon_code);
  if (cupom?.kind === "faturado" || t.redeems) return "resgates";
  if (cupom?.kind === "cortesia") return "cortesias";
  if (ticketKind(t.ticket_type ?? "") === "Credenciais") return "credenciais";
  const preco = Number(t.unit_price ?? t.total_price ?? 0);
  // Pago na Sympla, com ou sem cupom de desconto: o desconto não muda a categoria.
  if (preco > 0) return visita ? "visitas" : "pagos";
  return cupom ? "cortesias" : "gratuitos";
}
