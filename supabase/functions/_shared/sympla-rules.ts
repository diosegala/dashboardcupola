// Regras da sincronização da Sympla, sem acesso a rede ou banco, para poderem ser testadas.

export type Row = Record<string, any>;

// Prefixo da linha que guarda os ingressos já vendidos e ainda sem participante vinculado.
export const PENDING_PREFIX = "pendente-";

const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

export function isApprovedOrder(order: Row | null | undefined): boolean {
  const s = String(order?.order_status ?? "").toUpperCase();
  return s === "A" || s === "APPROVED";
}

// Descontos por quantidade que a Sympla aplica sobre o preço de um ingresso (lotes "2 a 5", cupons de 5%...).
const DISCOUNTS = [0, 0.05, 0.1, 0.15, 0.2];
const MAX_TICKETS = 100;

export interface PendingTickets {
  quantity: number;
  total: number;
  unitPrice: number;
  ticketName: string | null;
}

// Ingressos de um pedido aprovado que a Sympla ainda não devolve como participante (o comprador não preencheu os nomes).
// A Sympla não informa a quantidade do pedido: ela sai do valor que falta dividido pelo preço de um ingresso do evento.
// Conforme as pessoas são vinculadas, o valor que falta diminui e esta parte encolhe; o total do pedido não muda.
export function pendingTickets(order: Row, orderParticipants: Row[], eventParticipants: Row[]): PendingTickets | null {
  if (!isApprovedOrder(order)) return null;
  const linked = orderParticipants.reduce((s, p) => s + (Number(p.ticket_sale_price) || 0), 0);
  const missing = money(Number(order.order_total_net_value) - linked);
  if (!(missing > 1)) return null;

  const prices = new Map<number, string | null>();
  eventParticipants.forEach((p) => {
    const price = money(p.ticket_sale_price);
    if (price > 0 && !prices.has(price)) prices.set(price, p.ticket_name ?? null);
  });
  // Pedido sem nenhum participante no evento inteiro: sem preço de referência, conta ao menos um ingresso.
  if (!prices.size) return { quantity: 1, total: missing, unitPrice: missing, ticketName: null };

  let best: { quantity: number; error: number; name: string | null } | null = null;
  for (const [price, name] of prices) {
    for (const d of DISCOUNTS) {
      const unit = price * (1 - d);
      for (let q = 1; q <= MAX_TICKETS; q++) {
        const error = Math.abs(q * unit - missing);
        if (!best || error < best.error - 0.005 || (Math.abs(error - best.error) <= 0.005 && q < best.quantity)) {
          best = { quantity: q, error, name };
        }
        if (q * unit > missing) break;
      }
    }
  }
  const quantity = best!.quantity;
  return { quantity, total: missing, unitPrice: money(missing / quantity), ticketName: best!.name };
}

// Estado do comprador pela nota fiscal do pedido, quando ainda não há formulário de participante.
export function invoiceState(order: Row): string | null {
  const uf = String(order?.invoice_info?.address_state ?? "").trim();
  return uf || null;
}

// Empresa compradora, só quando a nota sai em CNPJ.
export function invoiceCompany(order: Row): string | null {
  const inv = order?.invoice_info ?? {};
  return String(inv.doc_type ?? "").toUpperCase() === "CNPJ" && inv.client_name ? String(inv.client_name).trim() : null;
}
