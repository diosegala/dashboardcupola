import { ticketKind } from "@/lib/ticketKinds";

// Categoria de venda: cada ingresso pagante entra em uma só.
export const SALES_CATEGORIES = ["Padrão", "VIP", "Combo", "Grupo", "Visita avulsa"] as const;
export type SalesCategory = (typeof SALES_CATEGORIES)[number];

export function salesCategory(name: string | null | undefined): SalesCategory | null {
  switch (ticketKind(name)) {
    case "Padrão":
      return "Padrão";
    case "Grupo":
      return "Grupo";
    case "VIP":
      return "VIP";
    case "Padrão Combo":
    case "VIP Combo":
      return "Combo";
    case "Visita presencial":
      return "Visita avulsa";
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
  // Grupo e Combo: quantos são VIP e quantos Padrão, pelo nome na Sympla ("Ingresso Summit" conta como Padrão).
  porNivel: { padrao: { ingressos: number; valor: number }; vip: { ingressos: number; valor: number } };
  // Visita avulsa comprada no mesmo pedido de um ingresso do evento: é o mesmo participante.
  juntoComEvento: number;
}

export const isVip = (name: string | null | undefined) => /\bvip\b/i.test(name ?? "");

// Código que identifica a venda: pedido na Sympla, negócio no Pipedrive.
export const saleCode = (t: Venda): string | null => t.deal_id ?? t.sympla_order_id ?? t.order_id ?? null;

export function salesByCategory(vendas: Venda[]): CategoryRow[] {
  const pedidosComEvento = new Set(
    vendas.filter((t) => { const c = salesCategory(t.ticket_type); return c && c !== "Visita avulsa"; }).map(saleCode).filter(Boolean),
  );
  return SALES_CATEGORIES.map((categoria) => {
    const daCategoria = vendas.filter((t) => salesCategory(t.ticket_type) === categoria);
    const ingressos = daCategoria.reduce((s, t) => s + (t.quantity || 0), 0);
    const valor = daCategoria.reduce((s, t) => s + Number(t.total_price || 0), 0);
    const semCodigo = daCategoria.filter((t) => !saleCode(t)).length;
    const pedidos = new Set(daCategoria.map(saleCode).filter(Boolean)).size + semCodigo;
    const nivel = (vip: boolean) => {
      const xs = daCategoria.filter((t) => isVip(t.ticket_type) === vip);
      return { ingressos: xs.reduce((s, t) => s + (t.quantity || 0), 0), valor: xs.reduce((s, t) => s + Number(t.total_price || 0), 0) };
    };
    const juntoComEvento = categoria === "Visita avulsa"
      ? daCategoria.filter((t) => { const c = saleCode(t); return c && pedidosComEvento.has(c); }).reduce((s, t) => s + (t.quantity || 0), 0)
      : 0;
    return { categoria, ingressos, pedidos, valor, media: ingressos > 0 ? valor / ingressos : null, porNivel: { padrao: nivel(false), vip: nivel(true) }, juntoComEvento };
  });
}
