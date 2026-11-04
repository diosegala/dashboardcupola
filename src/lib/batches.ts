// Lote do ingresso a partir do nome da Sympla: "Lote 7 | Ingresso VIP" → "Lote 7"; "Pré-Venda 2027 | ..." → "Lote 0".
// A pré-venda é o Lote 0: a contagem dos lotes começa em 0, e assim a comparação com o evento anterior casa lote com lote.

export function batchOf(ticketType: string | null | undefined): string | null {
  const antes = (ticketType ?? "").split("|")[0];
  const n = antes.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/pre[\s-]?venda/.test(n)) return "Lote 0";
  const lote = n.match(/lote\s*(\d+)/);
  if (!lote) return null;
  return `Lote ${Number(lote[1])}`;
}

// Ordem de venda pelo número do lote (Lote 0 primeiro).
export function batchOrder(batch: string) {
  const numero = batch.match(/\d+/);
  return numero ? Number(numero[0]) : 99;
}
