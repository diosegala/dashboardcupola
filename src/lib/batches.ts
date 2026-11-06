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

// Lote vigente pela data, sem calendário fixo (as datas de abertura mudam): cada lote começa no dia da primeira venda
// com o nome dele na Sympla, e vale até a primeira venda do lote seguinte. Toda venda conta no lote vigente no dia
// em que foi feita, inclusive faturados e ingressos com nome de lote anterior vendidos depois da virada.
export function batchStarts(tickets: { sold_at?: string | null; ticket_type?: string | null; source?: string }[]) {
  const inicio = new Map<string, string>();
  tickets.forEach((t) => {
    if (t.source === "pipedrive" || !t.sold_at) return;
    const lote = batchOf(t.ticket_type);
    if (!lote) return;
    const atual = inicio.get(lote);
    if (!atual || t.sold_at < atual) inicio.set(lote, t.sold_at);
  });
  return Array.from(inicio.entries())
    .map(([lote, desde]) => ({ lote, desde }))
    .sort((a, b) => batchOrder(a.lote) - batchOrder(b.lote));
}

export function batchOnDate(date: string, starts: { lote: string; desde: string }[]): string | null {
  let vigente: string | null = null;
  for (const s of starts) if (s.desde <= date) vigente = s.lote;
  return vigente ?? starts[0]?.lote ?? null;
}

// Troca o lote do nome do ingresso pelo lote vigente na data da venda ("Pré-Venda 2027 | Ingresso Padrão" vendido
// depois da abertura do Lote 0 vira "Lote 0 | Ingresso Padrão"). O tipo (Padrão, VIP, combo) não muda.
export function withBatchByDate<T extends { sold_at?: string | null; ticket_type?: string | null; source?: string }>(tickets: T[]): T[] {
  const starts = batchStarts(tickets);
  if (!starts.length) return tickets;
  return tickets.map((t) => {
    if (!t.sold_at || !batchOf(t.ticket_type)) return t;
    const lote = batchOnDate(t.sold_at, starts);
    if (!lote || lote === batchOf(t.ticket_type)) return t;
    const resto = (t.ticket_type ?? "").split("|").slice(1).join("|").trim();
    return { ...t, ticket_type: resto ? `${lote} | ${resto}` : lote };
  });
}
