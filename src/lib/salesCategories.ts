import { ticketKind } from "@/lib/ticketKinds";

// Categoria de venda: cada ingresso pagante entra em uma só.
export const SALES_CATEGORIES = ["Individual", "Grupo", "VIP", "Combo", "Visita"] as const;
export type SalesCategory = (typeof SALES_CATEGORIES)[number];

export function salesCategory(name: string | null | undefined): SalesCategory | null {
  switch (ticketKind(name)) {
    case "Padrão":
      return "Individual";
    case "Grupo":
      return "Grupo";
    case "VIP":
      return "VIP";
    case "Padrão Combo":
    case "VIP Combo":
      return "Combo";
    case "Visita presencial":
      return "Visita";
    default:
      return null;
  }
}

interface Venda {
  quantity: number | null;
  total_price: number | string | null;
  ticket_type?: string | null;
  sympla_order_id?: string | null;
  order_id?: string | null;
  deal_id?: string;
}

export interface CategoryRow {
  categoria: SalesCategory;
  ingressos: number;
  pedidos: number;
  valor: number;
  media: number | null;
}

// Código que identifica a venda: pedido na Sympla, negócio no Pipedrive.
export const saleCode = (t: Venda): string | null => t.deal_id ?? t.sympla_order_id ?? t.order_id ?? null;

export function salesByCategory(vendas: Venda[]): CategoryRow[] {
  return SALES_CATEGORIES.map((categoria) => {
    const daCategoria = vendas.filter((t) => salesCategory(t.ticket_type) === categoria);
    const ingressos = daCategoria.reduce((s, t) => s + (t.quantity || 0), 0);
    const valor = daCategoria.reduce((s, t) => s + Number(t.total_price || 0), 0);
    const semCodigo = daCategoria.filter((t) => !saleCode(t)).length;
    const pedidos = new Set(daCategoria.map(saleCode).filter(Boolean)).size + semCodigo;
    return { categoria, ingressos, pedidos, valor, media: ingressos > 0 ? valor / ingressos : null };
  });
}
