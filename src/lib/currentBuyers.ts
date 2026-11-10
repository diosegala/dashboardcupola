// Lista da equipe: quem já comprou o evento atual (Sympla + faturados).
// Pedido com participantes nomeados vira uma linha por pessoa; pedido ainda sem nomes (a Sympla repete o nome
// de quem comprou em todos os ingressos) vira uma linha só, com a quantidade.

import { titleCase, type DetailRow } from "./buyers";

export interface BuyerLine {
  id: string;
  nome: string;
  empresa: string | null;
  ingressos: number;
  origem: "Sympla" | "Faturado";
  nominal: boolean;
  cupom: string | null;
}

export interface InvoicedTicket {
  deal_id: string;
  deal_title?: string | null;
  company?: string | null;
  quantity: number;
  status?: string | null;
  bonus?: boolean;
}

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const aprovado = (s: unknown) => ["approved", "aprovado"].includes(norm(s));
const limpaCupom = (c: unknown) => (c ? String(c).replace(/^\s*[\d.,]+%\s*-\s*/, "").trim() || null : null);
const nomeDe = (first: unknown, last: unknown) => `${String(first ?? "").trim()} ${String(last ?? "").trim()}`.trim();

function empresaDe(p: any, o: any): string | null {
  const campo = (p?.custom_form ?? []).find((f: any) => /^empresa$|nome da empresa/i.test(String(f?.name ?? "")));
  const v = String(campo?.value ?? "").trim() || String(o?.invoice_info?.client_name ?? "").trim();
  return v ? titleCase(v) : null;
}

// Pedido sem nomes: todos os participantes vazios ou com o mesmo nome de quem comprou (com 2+ ingressos).
function semNomes(rows: DetailRow[], comprador: string): boolean {
  const nomes = rows.map((r) => norm(nomeDe(r.participant_data?.first_name, r.participant_data?.last_name)));
  if (nomes.every((n) => !n)) return true;
  return rows.length > 1 && nomes.every((n) => !n || n === norm(comprador));
}

// redeemed: negócio faturado -> ingressos já resgatados na Sympla (esses já aparecem com nome pela Sympla).
export function currentBuyers(rows: DetailRow[], invoiced: InvoicedTicket[], redeemed: Record<string, number> = {}): BuyerLine[] {
  const pedidos = new Map<string, DetailRow[]>();
  for (const r of rows) {
    const status = r.participant_data?.order_status ?? r.order_data?.order_status;
    if (!aprovado(status)) continue;
    const pedido = String(r.order_data?.id ?? r.participant_data?.order_id ?? r.sympla_order_id);
    pedidos.set(pedido, [...(pedidos.get(pedido) ?? []), r]);
  }

  const linhas: BuyerLine[] = [];
  for (const [pedido, rs] of pedidos) {
    const o = rs[0].order_data;
    const comprador = titleCase(nomeDe(o?.buyer_first_name, o?.buyer_last_name)) || "Sem nome";
    const cupom = limpaCupom(rs.find((r) => r.participant_data?.coupon)?.participant_data?.coupon);
    if (semNomes(rs, comprador)) {
      linhas.push({ id: `s-${pedido}`, nome: comprador, empresa: empresaDe(rs[0].participant_data, o), ingressos: rs.length, origem: "Sympla", nominal: false, cupom });
      continue;
    }
    rs.forEach((r, i) => {
      const p = r.participant_data;
      const nome = titleCase(nomeDe(p?.first_name, p?.last_name)) || comprador;
      linhas.push({ id: `s-${pedido}-${i}`, nome, empresa: empresaDe(p, o), ingressos: 1, origem: "Sympla", nominal: true, cupom: limpaCupom(p?.coupon) ?? cupom });
    });
  }

  const negocios = new Map<string, { qtd: number; empresa: string | null; titulo: string }>();
  for (const t of invoiced) {
    if (!aprovado(t.status)) continue;
    const n = negocios.get(t.deal_id) ?? { qtd: 0, empresa: t.company ?? null, titulo: String(t.deal_title ?? "") };
    n.qtd += Number(t.quantity) || 1;
    negocios.set(t.deal_id, n);
  }
  for (const [id, n] of negocios) {
    const faltam = n.qtd - (redeemed[id] ?? 0);
    if (faltam <= 0) continue;
    const empresa = n.empresa ? titleCase(n.empresa) : null;
    linhas.push({ id: `f-${id}`, nome: empresa ?? (n.titulo || "Venda faturada"), empresa, ingressos: faltam, origem: "Faturado", nominal: false, cupom: null });
  }
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
