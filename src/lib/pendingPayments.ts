// Vendas da Sympla aguardando pagamento (boleto ou pix ainda não compensados). Não contam como venda: entram quando o
// pagamento é aprovado e saem do aviso quando o pedido é cancelado ou fica sem pagamento.
// Cuidado: a API da Sympla mantém o status da hora da compra. Em 10/11/2026 um boleto de 07/11 já pago seguia pendente
// na API e confirmado na tela da Sympla. Por isso um pendente antigo pode já estar pago e deve ser conferido na Sympla.

export interface PendingOrder {
  id: string;
  criado: string | null;
  valor: number;
  dias: number | null;
}

// Pendente há mais tempo que isso provavelmente já foi pago (boleto compensa em até 3 dias úteis).
export const DIAS_PARA_CONFERIR = 3;

const PENDENTE = ["P", "PENDING"];
const DIA_MS = 24 * 60 * 60 * 1000;

// Data da Sympla ("2026-11-07 10:20:24", horário de Brasília) para instante.
const instante = (s: unknown): number | null => {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t.replace(" ", "T") : `${t.replace(" ", "T")}-03:00`;
  const n = new Date(iso).getTime();
  return Number.isNaN(n) ? null : n;
};

export function pendingPayments(rows: { order_data: any }[], agora: number = Date.now()) {
  const vistos = new Set<string>();
  const pedidos: PendingOrder[] = [];
  rows.forEach(({ order_data: o }) => {
    if (!o || !PENDENTE.includes(String(o.order_status ?? o.status ?? "").toUpperCase())) return;
    const id = String(o.id ?? "");
    if (!id || vistos.has(id)) return;
    vistos.add(id);
    const criado = instante(o.order_date ?? o.created_at);
    pedidos.push({
      id,
      criado: o.order_date ?? o.created_at ?? null,
      valor: Math.round(Number(o.order_total_sale_price ?? o.order_total_net_value ?? 0) * 100) / 100,
      dias: criado === null ? null : Math.floor((agora - criado) / DIA_MS),
    });
  });
  pedidos.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return {
    pedidos,
    valor: Math.round(pedidos.reduce((s, p) => s + p.valor, 0) * 100) / 100,
    paraConferir: pedidos.filter((p) => (p.dias ?? 0) > DIAS_PARA_CONFERIR),
  };
}
