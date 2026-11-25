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
  // Só quando há problema (Cancelado, Estornado, Pendente, Não pago). Venda aprovada fica sem etiqueta.
  status: string | null;
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
  // Aguardando há mais de 7 dias sem aprovar: tratado como cancelado.
  expirado?: boolean;
  quantidadesPorTipo?: Partial<Record<TicketKind, number>>;
  vendas?: Venda[];
}

const PAGAMENTO: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "Cartão de crédito", BOLETO: "Boleto", DEBIT_CARD: "Cartão de débito" };

// Nome do pagamento em português: a Sympla manda "boleto_bancario", "pix", "credit_card" e variações.
export function nomeDoPagamento(bruto: unknown): string | null {
  const s = String(bruto ?? "").trim();
  if (!s) return null;
  const exato = PAGAMENTO[s.toUpperCase()];
  if (exato) return exato;
  const k = s.toUpperCase().replace(/[^A-Z]/g, "");
  if (k.includes("BOLETO")) return "Boleto";
  if (k.includes("PIX")) return "Pix";
  if (k.includes("CREDIT")) return "Cartão de crédito";
  if (k.includes("DEBIT")) return "Cartão de débito";
  return s;
}

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
      // Visita avulsa não dá acesso ao evento: aparece com receita, mas com 0 participante.
      const ingressos = TICKET_KINDS.filter((k) => porTipo.get(k))
        .map((k) => (k === "Visita presencial" ? `${porTipo.get(k)} Visita avulsa (sem participante)` : `${porTipo.get(k)} ${k}`))
        .join(" · ");
      const codigoCupom = parseCoupon(t.coupon_code)?.code ?? null;
      const cupom = codigoCupom ? couponLabel(canonicalCoupon(codigoCupom)) : null;
      const codigo = (faturado ? t.deal_id : t.order_id ?? t.sympla_order_id) ?? null;
      const cliente = (faturado ? t.company || t.deal_title : t.buyer_name) || "Sem nome";
      // Mesmo lote do resto do painel: o do nome do ingresso, já trocado pelo lote da data (faturado pela criação).
      const lote = batchOf(t.ticket_type) ?? (t.sold_at ? loteNaData(String(t.sold_at), calendario) ?? "—" : "—");
      const vendedor = t.seller_name ?? t.seller ?? null;
      const canal = canalDe(t);
      const link = linkDe(t);
      const pagamento = nomeDoPagamento(t.payment_method);
      const tiposCompletos = [...new Set(itens.map((x) => (x.ticket_type ?? "").split("|").map((p) => p.trim()).filter((p) => !/^lote\s*\d+$/i.test(p)).join(" · ")).filter(Boolean))];
      return {
        chave,
        status: null as string | null,
        faturado,
        data: t.sold_at ?? null,
        lote,
        cliente,
        ingressos,
        quantidadesPorTipo: Object.fromEntries(porTipo),
        quantidade: itens.filter((x) => ticketKind(x.ticket_type) !== "Visita presencial").reduce((s, x) => s + (x.quantity || 0), 0),
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

// Agrupamento somente de apresentação; os pedidos originais continuam disponíveis nos detalhes e nos totais.
export function agruparComprador(vendas: Venda[]): Venda[] {
  const grupos = new Map<string, Venda[]>();
  for (const v of vendas) {
    const nome = v.cliente.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
    const identificado = nome && !["sem nome", "comprador não informado"].includes(nome);
    const chave = JSON.stringify([identificado ? nome : v.chave, v.faturado, v.lote, v.status, Boolean(v.expirado)]);
    const grupo = grupos.get(chave) ?? [];
    grupo.push(v);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].map((itens) => {
    const primeira = itens[0];
    if (itens.length === 1) return primeira;
    const tipos: Partial<Record<TicketKind, number>> = {};
    for (const v of itens) {
      for (const k of TICKET_KINDS) tipos[k] = (tipos[k] ?? 0) + (v.quantidadesPorTipo?.[k] ?? 0);
    }
    const ingressos = TICKET_KINDS.filter((k) => tipos[k]).map((k) =>
      k === "Visita presencial" ? `${tipos[k]} Visita avulsa (sem participante)` : `${tipos[k]} ${k}`,
    ).join(" · ");
    return {
      ...primeira,
      chave: `grupo-${itens.map((v) => v.chave).join("|")}`,
      quantidade: itens.reduce((s, v) => s + v.quantidade, 0),
      valor: Math.round(itens.reduce((s, v) => s + v.valor, 0) * 100) / 100,
      ingressos: ingressos || primeira.ingressos,
      quantidadesPorTipo: tipos,
      tiposCompletos: [...new Set(itens.flatMap((v) => v.tiposCompletos))],
      texto: itens.map((v) => v.texto).join(" "),
      vendas: itens,
    };
  });
}

// Etiqueta do status da Sympla, só para o que não está aprovado.
export function statusDaVenda(status: unknown): string | null {
  const s = String(status ?? "").toUpperCase();
  if (["A", "APPROVED"].includes(s)) return null;
  if (["P", "PENDING"].includes(s)) return "Pendente";
  if (["R", "REFUNDED"].includes(s)) return "Estornado";
  if (["C", "CANCELLED", "CANCELED"].includes(s)) return "Cancelado";
  if (["NP", "UNPAID", "NOT_APPROVED"].includes(s)) return "Não pago";
  return s ? "Verificar" : null;
}

// Pedido aguardando pagamento há mais que isso sem aprovar passa a valer como cancelado.
export const DIAS_PARA_CANCELAR = 7;
const DIA_MS = 24 * 60 * 60 * 1000;
export function expirou(data: string | null, agora: number = Date.now()) {
  const n = data ? new Date(data).getTime() : NaN;
  return !Number.isNaN(n) && agora - n > DIAS_PARA_CANCELAR * DIA_MS;
}

// Quantos dias completos se passaram desde a data do pedido. Sem data, não dá para dizer.
export function diasAguardando(data: string | null, agora: number = Date.now()): number | null {
  const n = data ? new Date(data).getTime() : NaN;
  return Number.isNaN(n) ? null : Math.max(0, Math.floor((agora - n) / DIA_MS));
}

// Por que a venda está com esse status, em linguagem de negócio.
// É o mesmo texto no aviso ao passar o mouse na etiqueta e no detalhe da venda, para os dois nunca divergirem.
export function motivoDoStatus(v: Venda, agora: number = Date.now()): string {
  if (!v.status) return "";
  const dias = diasAguardando(v.data, agora);
  const espera = !dias ? "" : dias === 1 ? " Está aguardando há 1 dia." : ` Está aguardando há ${dias} dias.`;
  const pag = (v.pagamento ?? "").toLowerCase();
  switch (v.status) {
    case "Pendente": {
      const motivo = pag.includes("boleto")
        ? "O boleto demora até 3 dias úteis para compensar depois de pago."
        : pag.includes("pix")
          ? "O Pix costuma aprovar em minutos: se ainda está pendente, o pagamento provavelmente não foi feito."
          : pag.includes("cart")
            ? "A maioria dos cartões aprova na hora; compras retidas podem levar até 72 horas."
            : "Ainda não temos a confirmação do pagamento na Sympla.";
      return `Aguardando pagamento${v.pagamento ? ` por ${v.pagamento.toLowerCase()}` : ""}. ${motivo}${espera} Ainda não conta como venda. Se passar de ${DIAS_PARA_CANCELAR} dias sem aprovar, vira cancelado.`;
    }
    case "Cancelado":
      return v.expirado
        ? `Cancelado aqui no painel: ficou mais de ${DIAS_PARA_CANCELAR} dias aguardando pagamento sem aprovar. Não conta na receita.`
        : "Cancelado na Sympla: o comprador desistiu ou o pagamento não foi aprovado. Não conta na receita.";
    case "Estornado":
      return "Estornado na Sympla: o valor pago foi devolvido ao comprador. Não conta na receita.";
    case "Não pago":
      return "Não pago: o pedido foi criado, mas o pagamento não entrou. Não conta na receita.";
    default:
      return "Status diferente do esperado na Sympla: confirme o pedido na Sympla. Não conta na receita.";
  }
}
// Grupo do filtro do extrato.
export type GrupoStatus = "aprovadas" | "aguardando" | "canceladas";
export const grupoDe = (v: Venda): GrupoStatus => (!v.status ? "aprovadas" : v.status === "Pendente" ? "aguardando" : "canceladas");

// Data da Sympla ("2026-11-07 10:20:24", horário de Brasília) em ISO.
const isoBrasilia = (s: unknown) => {
  const t = String(s ?? "").trim();
  return t ? (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t.replace(" ", "T") : `${t.replace(" ", "T")}-03:00`) : null;
};

// Extrato completo: vendas pagas (sem etiqueta), vendas da Sympla canceladas ou estornadas depois da compra e pedidos
// aguardando pagamento, que ainda não têm ingresso gravado. Só as pagas somam nos totais.
export function vendasDoExtrato(pagantes: Ticket[], todas: Ticket[], pedidosSemIngresso: { order_data: any }[] = [], calendario = batchCalendar(), agora: number = Date.now()): Venda[] {
  const pagas = agruparVendas(pagantes, calendario);
  const comProblema = agruparVendas(
    todas.filter((t) => t.source !== "pipedrive" && statusDaVenda(t.status) && Number(t.total_price || 0) > 0),
    calendario,
  ).map((v, i) => ({ ...v, status: statusDaVenda(todas.find((t) => (t.order_id ?? t.sympla_order_id) === v.codigo)?.status) ?? "Verificar", chave: `${v.chave}-st${i}` }));
  const pendentes: Venda[] = pedidosSemIngresso
    .map((r) => r.order_data)
    .filter((o) => o && statusDaVenda(o.order_status ?? o.status) && Number(o.order_total_sale_price ?? o.order_total_net_value ?? 0) > 0)
    .map((o) => {
      const data = isoBrasilia(o.order_date ?? o.created_at);
      const status = statusDaVenda(o.order_status ?? o.status) as string;
      const cliente = [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(" ") || "Comprador não informado";
      return {
        chave: `pend-${o.id}`,
        status,
        faturado: false,
        data,
        lote: data ? loteNaData(data, calendario) ?? "—" : "—",
        cliente,
        ingressos: status === "Pendente" ? "Aguardando pagamento" : "Sem ingresso",
        quantidade: 0,
        valor: Math.round(Number(o.order_total_net_value ?? o.order_total_sale_price ?? 0) * 100) / 100,
        codigo: String(o.id),
        linkNegocio: null,
        tiposCompletos: [],
        cupom: o.discount_code ? String(o.discount_code) : null,
        canal: "—",
        link: null,
        vendedor: null,
        pagamento: nomeDoPagamento(o.transaction_type),
        texto: [cliente, o.id, status, o.discount_code].filter(Boolean).join(" ").toLowerCase(),
      };
    });
  // Mesmo pedido só uma vez; aguardando há mais de 7 dias vira cancelado.
  const vistos = new Set<string>();
  return [...pagas, ...comProblema, ...pendentes]
    .filter((v) => v.faturado || !v.codigo || !v.status || (vistos.has(v.codigo) ? false : (vistos.add(v.codigo), true)))
    .map((v) => (v.status === "Pendente" && expirou(v.data, agora) ? { ...v, status: "Cancelado", expirado: true, texto: `${v.texto} cancelado` } : v))
    .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
}
