import { batchCalendar, diaBrasilia, hojeBrasilia, loteNaData, loteVigente, type BatchDates } from "@/lib/batchCalendar";
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
// Com calendário cadastrado (Configurações › Lotes), vale o lote cujo período contém o dia da venda em Brasília;
// antes do primeiro lote, Lote 0; depois do último, o último.
export function withBatchByDate<T extends { sold_at?: string | null; batch_at?: string | null; batch_fixed?: string | null; ticket_type?: string | null; source?: string }>(tickets: T[], calendario: BatchDates[] = []): T[] {
  const datados = calendario.filter((c) => c.start_date && c.end_date);
  const starts = datados.length
    ? datados.map((c) => ({ lote: c.name, desde: c.start_date as string })).sort((a, b) => a.desde.localeCompare(b.desde))
    : batchStarts(tickets);
  const loteDe = (soldAt: string) => (datados.length ? loteNaData(soldAt, datados) ?? batchOnDate(diaBrasilia(soldAt), starts) : batchOnDate(soldAt, starts));
  return tickets.map((t) => {
    const proprio = batchOf(t.ticket_type);
    if (!t.sold_at || !proprio) return t;
    if (proprio === PRE_VENDA && t.source !== "pipedrive") return t;
    const lote = t.batch_fixed || loteDe(t.batch_at ?? t.sold_at);
    if (lote === proprio) return t;
    const resto = (t.ticket_type ?? "").split("|").slice(1).join("|").trim();
    return { ...t, ticket_type: resto ? `${lote} | ${resto}` : lote };
  });
}

// Ordem comum das listas de lotes: vigente primeiro, depois os anteriores do mais recente para o mais antigo.
// Lote com início futuro não aparece; entra sozinho no dia de abertura (horário de Brasília).
export function lotesParaLista(
  lotes: string[],
  vigente: string | null = loteVigente(batchCalendar()).lote,
  calendario: BatchDates[] = batchCalendar(),
  hoje = hojeBrasilia(),
  incluirFuturos = false,
): string[] {
  const futuros = new Set(incluirFuturos ? [] : calendario.filter((l) => l.start_date && l.start_date > hoje).map((l) => l.name));
  const unicos = [...new Set(lotes.filter(Boolean))].filter((l) => !futuros.has(l));
  const atual = vigente && unicos.includes(vigente) && !futuros.has(vigente) ? vigente : null;
  const ordem = (l: string) => batchOrder(l);
  if (!atual) return unicos.sort((a, b) => ordem(b) - ordem(a));
  const v = ordem(atual);
  const anteriores = unicos.filter((l) => ordem(l) < v).sort((a, b) => ordem(b) - ordem(a));
  const posterioresIniciados = unicos.filter((l) => l !== atual && ordem(l) > v).sort((a, b) => ordem(a) - ordem(b));
  return [atual, ...anteriores, ...posterioresIniciados];
}
