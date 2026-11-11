// Linhas do extrato de vendas: uma por venda (pedido da Sympla ou negócio faturado), com os ingressos somados.
// A Sympla grava um ingresso por linha; aqui os ingressos do mesmo pedido viram uma venda só.
import { batchOf } from "@/lib/batches";
import { batchCalendar, loteNaData } from "@/lib/batchCalendar";
import { canonicalCoupon, couponLabel, parseCoupon } from "@/lib/coupons";
import { canalDe } from "@/lib/salesChannel";
import { ticketKind, TICKET_KINDS, type TicketKind } from "@/lib/ticketKinds";
import { utmTexto } from "@/components/dashboard/CommercialSegments";
import type { Ticket } from "@/hooks/useCommercialMetrics";

export interface Venda {
  chave: string;
  faturado: boolean;
  data: string | null;
  lote: string;
  cliente: string;
  // "5 Grupo" ou "2 VIP · 1 Padrão".
  ingressos: string;
  quantidade: number;
  valor: number;
  // Pedido da Sympla (35EA3…) ou número do negócio no Pipedrive.
  codigo: string | null;
  linkNegocio: string | null;
  tiposCompletos: string[];
  cupom: string | null;
  canal: string;
  link: string | null;
  vendedor: string | null;
  pagamento: string | null;
  texto: string;
}

const PAGAMENTO: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto", DEBIT_CARD: "Cartão de débito" };

const linkDe = (t: Ticket) => {
  if (t.source === "pipedrive") return null;
  const partes = [t.utm_source, t.utm_medium, t.utm_campaign, t.utm_content].map(utmTexto);
  return partes[0] ? partes.map((p) => p || "—").join(" / ") : null;
};

export function agruparVendas(pagantes: Ticket[], calendario = batchCalendar()): Venda[] {
  const grupos = new Map<string, Ticket[]>();
  pagantes.forEach((t, i) => {
    const chave = t.source === "pipedrive" ? `neg-${t.deal_id ?? i}` : `ped-${t.order_id ?? t.sympla_order_id ?? i}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), t]);
  });
  return Array.from(grupos.entries())
    .map(([chave, itens]) => {
      const t = itens[0];
      const faturado = t.source === "pipedrive";
      const porTipo = new Map<TicketKind, number>();
      itens.forEach((x) => porTipo.set(ticketKind(x.ticket_type), (porTipo.get(ticketKind(x.ticket_type)) ?? 0) + (x.quantity || 0)));
      const ingressos = TICKET_KINDS.filter((k) => porTipo.get(k)).map((k) => `${porTipo.get(k)} ${k}`).join(" · ");
      const codigoCupom = parseCoupon(t.coupon_code)?.code ?? null;
      const cupom = codigoCupom ? couponLabel(canonicalCoupon(codigoCupom)) : null;
      const codigo = (faturado ? t.deal_id : t.order_id ?? t.sympla_order_id) ?? null;
      const cliente = (faturado ? t.company || t.deal_title : t.buyer_name) || "Sem nome";
      // Mesmo lote do resto do painel: o do nome do ingresso, já trocado pelo lote da data (faturado pela criação).
      const lote = batchOf(t.ticket_type) ?? (t.sold_at ? loteNaData(String(t.sold_at), calendario) ?? "—" : "—");
      const vendedor = t.seller_name ?? t.seller ?? null;
      const canal = canalDe(t);
      const link = linkDe(t);
      const pagamento = t.payment_method ? PAGAMENTO[String(t.payment_method).toUpperCase()] ?? t.payment_method : null;
      const tiposCompletos = [...new Set(itens.map((x) => (x.ticket_type ?? "").split("|").map((p) => p.trim()).filter((p) => !/^lote\s*\d+$/i.test(p)).join(" · ")).filter(Boolean))];
      return {
        chave,
        faturado,
        data: t.sold_at ?? null,
        lote,
        cliente,
        ingressos,
        quantidade: itens.reduce((s, x) => s + (x.quantity || 0), 0),
        valor: Math.round(itens.reduce((s, x) => s + Number(x.total_price || 0), 0) * 100) / 100,
        codigo,
        linkNegocio: faturado && t.crm_account && t.deal_id ? `https://${t.crm_account}.pipedrive.com/deal/${t.deal_id}` : null,
        tiposCompletos,
        cupom,
        canal,
        link,
        vendedor,
        pagamento,
        texto: [cliente, codigo, cupom, codigoCupom, canal, link, vendedor, ingressos].filter(Boolean).join(" ").toLowerCase(),
      };
    })
    .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
}
