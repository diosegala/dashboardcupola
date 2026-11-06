// Lote do ingresso a partir do nome da Sympla: "Lote 7 | Ingresso VIP" → "Lote 7"; "Pré-Venda 2027 | ..." → "Pré-venda".
// A pré-venda vem antes do Lote 0: a ordem de venda é Pré-venda, Lote 0, Lote 1, Lote 2…

export const PRE_VENDA = "Pré-venda";

export function batchOf(ticketType: string | null | undefined): string | null {
  const antes = (ticketType ?? "").split("|")[0];
  const n = antes.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/pre[\s-]?venda/.test(n)) return PRE_VENDA;
  const lote = n.match(/lote\s*(\d+)/);
  if (!lote) return null;
  return `Lote ${Number(lote[1])}`;
}

// Ordem de venda: a pré-venda vale -1 (antes do Lote 0) e os demais pelo número do lote.
export function batchOrder(batch: string) {
  if (batch === PRE_VENDA) return -1;
  const numero = batch.match(/\d+/);
  return numero ? Number(numero[0]) : 99;
}

// Lote vigente pela data: a Pré-venda é só o ingresso "Pré-Venda" vendido na Sympla (nunca recebe outras vendas).
// Os demais lotes começam no dia da primeira venda com o nome deles na Sympla e valem até a primeira venda do
// lote seguinte; antes de qualquer lote numerado, tudo cai no Lote 0. Faturados entram pelo lote vigente na data.
export const LOTE_INICIAL = "Lote 0";

export function batchStarts(tickets: { sold_at?: string | null; ticket_type?: string | null; source?: string }[]) {
  const inicio = new Map<string, string>();
  tickets.forEach((t) => {
    if (t.source === "pipedrive" || !t.sold_at) return;
    const lote = batchOf(t.ticket_type);
    if (!lote || lote === PRE_VENDA) return;
    const atual = inicio.get(lote);
    if (!atual || t.sold_at < atual) inicio.set(lote, t.sold_at);
  });
  return Array.from(inicio.entries())
    .map(([lote, desde]) => ({ lote, desde }))
    .sort((a, b) => batchOrder(a.lote) - batchOrder(b.lote));
}

export function batchOnDate(date: string, starts: { lote: string; desde: string }[]): string {
  let vigente: string | null = null;
  for (const s of starts) if (s.desde <= date) vigente = s.lote;
  return vigente ?? LOTE_INICIAL;
}

// Troca o lote do nome do ingresso pelo lote vigente na data da venda. Exceção: ingresso "Pré-Venda" da Sympla
// continua na Pré-venda. O tipo (Padrão, VIP, combo) não muda.
export function withBatchByDate<T extends { sold_at?: string | null; ticket_type?: string | null; source?: string }>(tickets: T[]): T[] {
  const starts = batchStarts(tickets);
  return tickets.map((t) => {
    const proprio = batchOf(t.ticket_type);
    if (!t.sold_at || !proprio) return t;
    if (proprio === PRE_VENDA && t.source !== "pipedrive") return t;
    const lote = batchOnDate(t.sold_at, starts);
    if (lote === proprio) return t;
    const resto = (t.ticket_type ?? "").split("|").slice(1).join("|").trim();
    return { ...t, ticket_type: resto ? `${lote} | ${resto}` : lote };
  });
}
