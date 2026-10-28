// Lote do ingresso a partir do nome da Sympla: "Lote 7 | Ingresso VIP" → "Lote 7"; "Pré-Venda 2027 | ..." → "Pré-venda".

export function batchOf(ticketType: string | null | undefined): string | null {
  const antes = (ticketType ?? "").split("|")[0];
  const n = antes.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/pre[\s-]?venda/.test(n)) return "Pré-venda";
  const lote = n.match(/lote\s*(\d+)/);
  if (!lote) return null;
  // Lote 0 é a pré-venda para quem já veio em anos anteriores: compara com a pré-venda dos outros anos.
  return Number(lote[1]) === 0 ? "Pré-venda" : `Lote ${Number(lote[1])}`;
}

// Ordem de venda: pré-venda primeiro, depois os lotes pelo número.
export function batchOrder(batch: string) {
  return batch === "Pré-venda" ? 0 : Number(batch.replace(/\D/g, "")) || 99;
}
