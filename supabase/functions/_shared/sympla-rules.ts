// Regras da sincronização da Sympla, sem acesso a rede ou banco, para poderem ser testadas.

export type Row = Record<string, any>;

// Prefixo das linhas de estimativa que versões antigas gravavam; a sincronização agora só apaga essas linhas.
export const PENDING_PREFIX = "pendente-";

const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

// Ingressos que o painel guarda, como a Sympla mostra: confirmados e pendentes. Não pagos (NP), cancelados e
// estornados ficam fora. A 1.5.1 só devolvia aprovados; a 1.6.0 pode devolver os demais.
export function keepsTicket(status: unknown): boolean {
  return ["a", "approved", "p", "pending"].includes(String(status ?? "").toLowerCase());
}

export function isApprovedOrder(order: Row | null | undefined): boolean {
  const s = String(order?.order_status ?? "").toUpperCase();
  return s === "A" || s === "APPROVED";
}

// Valor líquido do ingresso: ticket_net_value na API 1.6.0; na 1.5.1 o ticket_sale_price já vinha líquido
// (ex.: 833,93 para um ingresso de R$ 890), o mesmo critério do order_total_net_value do pedido.
export function participantPrice(p: Row): number {
  return money(p.ticket_net_value ?? p.ticket_sale_price ?? 0);
}

// Número do ingresso sem hífen e em maiúsculas: igual nas versões 1.5.1 e 1.6.0 da API, ao contrário do id do
// participante, que mudou de formato na 1.6.0.
export const ticketKey = (n: unknown) => String(n ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();

export interface MergedParticipant {
  // Chave da linha em ticket_sales (sympla_order_id): a já gravada para o ingresso, senão o id da Sympla.
  key: string;
  p: Row;
}

// Junta os participantes das duas versões da API, um por ingresso. Em 06/11/2026 a 1.5.1 (contrato legado) devolvia
// 29 dos 59 ingressos confirmados: nada criado ou alterado depois de 04/11 12:07. A 1.6.0 é o contrato atual.
// O dado da 1.6.0 prevalece (mais atual); a chave da linha já gravada é mantida para não duplicar ingresso, e o pedido
// do legado é usado quando o da 1.6.0 não está na lista de pedidos.
// Trava contra duplicar: ingresso da 1.6.0 sem número é ignorado, e se a 1.6.0 não reconhece nenhum ingresso que a
// 1.5.1 já devolve (formato diferente), ela inteira é descartada. Nos dois casos o resumo mostra o motivo.
export function mergeParticipants(legacy: Row[], current: Row[], savedKeyByTicket: Map<string, string>, orderIds: Set<string>) {
  const out = new Map<string, MergedParticipant>();
  const keyOf = (p: Row, fallback: string) => savedKeyByTicket.get(ticketKey(p.ticket_number)) ?? fallback;
  const idOf = (p: Row) => ticketKey(p.ticket_number) || `id:${p.id}`;
  legacy.forEach((p) => out.set(idOf(p), { key: keyOf(p, String(p.id)), p }));
  const comNumero = current.filter((p) => ticketKey(p.ticket_number));
  const reconhecidos = comNumero.filter((p) => out.has(ticketKey(p.ticket_number)) || savedKeyByTicket.has(ticketKey(p.ticket_number))).length;
  const descartada = comNumero.length > 0 && (legacy.length > 0 || savedKeyByTicket.size > 0) && reconhecidos === 0;
  const stats = { semNumero: current.length - comNumero.length, reconhecidos, descartada };
  if (descartada) return { participants: Array.from(out.values()), stats };
  comNumero.forEach((p) => {
    const id = idOf(p);
    const old = out.get(id);
    if (!old) {
      out.set(id, { key: keyOf(p, String(p.id)), p });
      return;
    }
    const pedido = orderIds.has(String(p.order_id ?? "")) ? p.order_id : old.p.order_id ?? p.order_id;
    const atual = Object.fromEntries(Object.entries(p).filter(([, v]) => v != null));
    out.set(id, { key: old.key, p: { ...old.p, ...atual, id: old.p.id, order_id: pedido } });
  });
  return { participants: Array.from(out.values()), stats };
}

// Pedidos aprovados cujos participantes não fecham o valor líquido do pedido (order_total_net_value). Serve para o
// resumo da sincronização mostrar se ainda falta ingresso de algum pedido.
export function incompleteOrders(orders: Row[], participants: Row[]): Row[] {
  const byOrder = new Map<string, { count: number; value: number }>();
  participants.forEach((p) => {
    const k = String(p.order_id ?? "");
    const cur = byOrder.get(k) ?? { count: 0, value: 0 };
    byOrder.set(k, { count: cur.count + 1, value: cur.value + participantPrice(p) });
  });
  return orders.filter((o) => {
    if (!isApprovedOrder(o)) return false;
    const got = byOrder.get(String(o.id));
    if (!got) return true;
    return money(Number(o.order_total_net_value) - got.value) > 0.5;
  });
}

// Participantes gravados que a Sympla não devolveu nesta sincronização e que passam a cancelados. Só sai quem tem o
// pedido fora da lista de pedidos aprovados: a ausência na lista de participantes, sozinha, não prova cancelamento
// (a API omite participantes de pedidos aprovados). Sem a lista de pedidos, ninguém é cancelado.
export function participantsToCancel(saved: { sympla_order_id: string; order_id: string | null }[], returnedIds: Set<string>, approvedOrderIds: Set<string>): string[] {
  if (!approvedOrderIds.size) return [];
  return saved
    .filter((r) => !returnedIds.has(String(r.sympla_order_id)) && !approvedOrderIds.has(String(r.order_id ?? "")))
    .map((r) => String(r.sympla_order_id));
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
