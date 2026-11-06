// Regras da sincronização da Sympla, sem acesso a rede ou banco, para poderem ser testadas.

export type Row = Record<string, any>;

// Prefixo das linhas de estimativa que versões antigas gravavam; a sincronização agora só apaga essas linhas.
export const PENDING_PREFIX = "pendente-";

const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

export function isApprovedOrder(order: Row | null | undefined): boolean {
  const s = String(order?.order_status ?? "").toUpperCase();
  return s === "A" || s === "APPROVED";
}

// Pedidos aprovados cujos participantes não fecham o valor do pedido. A lista de participantes do evento na API
// pública deixa de devolver ingressos preenchidos ou alterados depois de certo momento (visto em 06/11/2026: 29 de 59),
// enquanto a lista de pedidos segue completa. Esses pedidos são consultados um a um, pelos participantes do pedido.
// O valor de cada participante (ticket_sale_price) é o líquido do ingresso, o mesmo do pedido (order_total_net_value).
export function incompleteOrders(orders: Row[], participants: Row[]): Row[] {
  const byOrder = new Map<string, { count: number; value: number }>();
  participants.forEach((p) => {
    const k = String(p.order_id ?? "");
    const cur = byOrder.get(k) ?? { count: 0, value: 0 };
    byOrder.set(k, { count: cur.count + 1, value: cur.value + (Number(p.ticket_sale_price) || 0) });
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
