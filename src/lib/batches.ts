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
