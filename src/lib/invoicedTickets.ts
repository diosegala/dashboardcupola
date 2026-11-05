import { PRE_VENDA, batchOf, batchOrder } from "@/lib/batches";

// Ingressos faturados internamente: negócios ganhos no Pipedrive com produto "Ingressos Summit ..." (código Educação).
// Cada linha de produto vira uma venda no mesmo formato da Sympla, para somar em valor, quantidade, lotes e ranking.

const sem = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Produto de ingresso do Summit. Cotas, adicionais e outros produtos (Mob Report etc.) ficam de fora.
export const isTicketProduct = (name: unknown) => sem(name).startsWith("ingressos summit");

// Nome que a Sympla usaria para o tipo, para o painel reconhecer Padrão, VIP, combos e visita.
export function ticketTypeName(product: unknown): string {
  const n = sem(product);
  if (n.includes("combo") && n.includes("vip")) return "Combo VIP";
  if (n.includes("combo")) return "Combo Padrão";
  if (n.includes("vip")) return "Ingresso VIP";
  if (n.includes("visita")) return "Visita presencial";
  return "Ingresso Padrão";
}

// Palavras do campo "ID da fonte do canal" que não são o nome da pessoa ("Indicação Rodrigo", "Venda interna - Suelen").
const NAO_NOME = new Set(["indicacao", "venda", "vendas", "interna", "interno", "de", "da", "do", "por", "-", "|"]);

// Primeiro nome do vendedor a partir do campo do Pipedrive: "Suelen Moreira" → "Suelen". Vazio → null.
export function sellerFirstName(raw: unknown): string | null {
  const palavras = String(raw ?? "").trim().split(/[\s\-|/]+/).filter((p) => p && !NAO_NOME.has(sem(p)));
  if (!palavras.length || /^\d+$/.test(palavras[0])) return null;
  const p = palavras[0].toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// Lote vigente numa data: o da última venda da Sympla até aquele dia (o lote muda pela Sympla).
export function batchAt(date: string, symplaSales: { sold_at: string | null; ticket_type?: string | null }[]): string {
  let melhor: { at: string; lote: string } | null = null;
  for (const t of symplaSales) {
    const lote = batchOf(t.ticket_type);
    if (!lote || !t.sold_at || t.sold_at > date) continue;
    if (!melhor || t.sold_at > melhor.at || (t.sold_at === melhor.at && batchOrder(lote) > batchOrder(melhor.lote))) melhor = { at: t.sold_at, lote };
  }
  return melhor?.lote ?? PRE_VENDA;
}

// Canal dos faturados internos na origem da venda.
export const INVOICED_CHANNEL = "Venda direta";

export interface InvoicedDeal {
  pipedrive_deal_id: string;
  title: string | null;
  won_at: string | null;
  custom_fields: Record<string, unknown> | null;
}
export interface InvoicedLine {
  deal_id: string;
  name: string | null;
  quantity: number | null;
  item_price: number | null;
  sum: number | null;
}

export function invoicedToTickets(
  deals: (InvoicedDeal & { id: string })[],
  lines: InvoicedLine[],
  symplaSales: { sold_at: string | null; ticket_type?: string | null }[],
) {
  const porId = new Map(deals.map((d) => [d.id, d]));
  return lines
    .filter((l) => isTicketProduct(l.name) && porId.has(l.deal_id))
    .map((l) => {
      const d = porId.get(l.deal_id)!;
      const quando = d.won_at as string;
      const vendedor = String(d.custom_fields?.__channel_id ?? "").trim() || null;
      return {
        source: "pipedrive" as const,
        quantity: Number(l.quantity) || 1,
        total_price: Number(l.sum ?? 0),
        unit_price: Number(l.item_price ?? 0),
        sold_at: quando,
        // Data do pagamento do boleto: ainda não existe no CRM (virá do financeiro).
        paid_at: null as string | null,
        status: "approved",
        coupon_code: null,
        // Na origem da venda (Marketing) o faturado aparece como venda direta: nem sempre é da equipe do ranking
        // (o site pede para grandes quantidades chamarem o comercial).
        utm_source: INVOICED_CHANNEL,
        ticket_type: `${batchAt(quando, symplaSales)} | ${ticketTypeName(l.name)}`,
        seller: vendedor,
        seller_name: sellerFirstName(vendedor),
        deal_id: d.pipedrive_deal_id,
        deal_title: d.title,
      };
    });
}
