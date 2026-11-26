import { ticketCategory } from "./ticketCategory";

type CrmTicket = Parameters<typeof ticketCategory>[0] & {
  stage_name?: string | null;
  deal_id?: string | null;
  quantity?: number | null;
};

// The card's main unit is tickets; CRM cards are distinct deals, not product lines.
export function crmInProgress(tickets: CrmTicket[]) {
  const deals = new Set<string>();
  let ingressos = 0;
  for (const ticket of tickets) {
    const stage = (ticket.stage_name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    if (ticketCategory(ticket) !== "negociacao" || !["negociacao", "fechamento"].includes(stage)) continue;
    ingressos += ticket.quantity ?? 0;
    if (ticket.deal_id) deals.add(ticket.deal_id);
  }
  return { ingressos, cards: deals.size };
}