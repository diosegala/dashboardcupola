import { ticketCategory } from "@/lib/ticketCategory";
import { tipoDePreco } from "@/lib/lotPricing";
import { ticketKind } from "@/lib/ticketKinds";
import { parseCoupon } from "@/lib/coupons";

export type TicketDesconto = {
  quantity?: number | null;
  total_price?: number | string | null;
  unit_price?: number | string | null;
  sold_at?: string | null;
  status?: string | null;
  coupon_code?: string | null;
  ticket_type?: string | null;
  source?: "sympla" | "pipedrive";
  redeems?: string | null;
  bonus?: boolean;
  deal_id?: string;
  deal_title?: string | null;
  conferir?: string | null;
};

export type ItemForaDesconto = { id: string; rotulo: string; quantidade: number; motivo: string };

// O que fica fora por natureza, separando cortesias de resgates de negócios já faturados.
export function foraDoDesconto(tickets: TicketDesconto[]): ItemForaDesconto[] {
  const grupos = new Map<string, ItemForaDesconto>();
  const add = (id: string, rotulo: string, quantidade: number, motivo: string) => {
    const atual = grupos.get(id) ?? { id, rotulo, quantidade: 0, motivo };
    atual.quantidade += quantidade;
    grupos.set(id, atual);
  };
  tickets.forEach((t) => {
    const q = t.quantity || 0;
    if (q <= 0) return;
    const categoria = ticketCategory(t);
    const credencial = ticketKind(t.ticket_type ?? "") === "Credenciais" || !!parseCoupon(t.coupon_code)?.code.startsWith("CRED");
    if (categoria === "resgates") {
      add("resgates", "Resgate de negócio faturado", q, "O ingresso já foi pago no faturado; o cupom de 100% serve só para emitir na Sympla.");
    } else if (categoria === "visitas") {
      add("visitas", "Visita avulsa", q, "Não dá acesso ao evento e tem preço próprio.");
    } else if (categoria === "cortesias" && !credencial) {
      add("cortesias", "Sorteio ou cortesia", q, "Ingresso dado, sem cobrança; não é uma venda com desconto.");
    } else if (categoria === "credenciais" || categoria === "gratuitos" || credencial) {
      add("gratuitos", "Credencial ou gratuidade", q, "Ingresso sem cobrança; não é uma venda com desconto.");
    }
  });
  const ordem = ["resgates", "cortesias", "gratuitos", "visitas"];
  return ordem.map((id) => grupos.get(id)).filter((x): x is ItemForaDesconto => !!x);
}

export type AlertaCrm = { campo: string; negocios: number };

// Só campos necessários para este cálculo. Desconto preenchido no CRM não é exigido: usa-se o valor fechado.
export function alertasCrmDesconto(tickets: TicketDesconto[]): AlertaCrm[] {
  const porCampo = new Map<string, Set<string>>();
  tickets.forEach((t, i) => {
    if (t.source !== "pipedrive" || ticketCategory(t) !== "faturados") return;
    const id = t.deal_id || t.deal_title || `linha-${i}`;
    const add = (campo: string) => {
      const negocios = porCampo.get(campo) ?? new Set<string>();
      negocios.add(id);
      porCampo.set(campo, negocios);
    };
    if (!t.sold_at) add("Data do negócio");
    if (t.total_price == null) add("Valor fechado");
    if (!tipoDePreco(t.ticket_type)) add("Tipo de ingresso ou lote");
    if (t.conferir) {
      add(t.conferir.includes("produto") || t.conferir.includes("Produto") ? "Produto de ingresso" : "Quantidade de ingressos");
    }
  });
  return [...porCampo].map(([campo, negocios]) => ({ campo, negocios: negocios.size }));
}
