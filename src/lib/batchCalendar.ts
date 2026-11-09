// Calendário de lotes cadastrado em Configurações › Lotes. Início e término entram no período.
// Todas as datas são comparadas no horário de Brasília: a troca de lote acontece à meia-noite do dia de início.

export interface BatchDates {
  name: string;
  start_date: string | null;
  end_date: string | null;
  sort_order?: number;
}

export type Situacao = "encerrado" | "vigente" | "nao_iniciado";

// Data (YYYY-MM-DD) de um instante no horário de Brasília.
export function diaBrasilia(d: Date | string = new Date()): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
export const hojeBrasilia = () => diaBrasilia();

const ordenados = (lotes: BatchDates[]) =>
  [...lotes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.start_date ?? "").localeCompare(b.start_date ?? ""));

export const faltamDatas = (lotes: BatchDates[]) => lotes.some((l) => !l.start_date || !l.end_date);

// Lote vigente: hoje entre início e término; fora de qualquer lote, o próximo a começar.
// Sem calendário: null. Com alguma data faltando: não escolhe e avisa.
export function loteVigente(lotes: BatchDates[], hoje = hojeBrasilia()): { lote: string | null; faltamDatas: boolean } {
  if (!lotes.length) return { lote: null, faltamDatas: false };
  if (faltamDatas(lotes)) return { lote: null, faltamDatas: true };
  const lista = ordenados(lotes);
  const dentro = lista.find((l) => l.start_date! <= hoje && hoje <= l.end_date!);
  if (dentro) return { lote: dentro.name, faltamDatas: false };
  const proximo = lista.filter((l) => l.start_date! > hoje).sort((a, b) => a.start_date!.localeCompare(b.start_date!))[0];
  return { lote: proximo?.name ?? null, faltamDatas: false };
}

export function situacao(l: BatchDates, hoje = hojeBrasilia()): Situacao | null {
  if (!l.start_date || !l.end_date) return null;
  if (hoje > l.end_date) return "encerrado";
  if (hoje < l.start_date) return "nao_iniciado";
  return "vigente";
}

// Lote de uma venda pela data cadastrada (horário de Brasília). Fora dos períodos: null.
export function loteNaData(soldAt: string, lotes: BatchDates[]): string | null {
  const dia = diaBrasilia(soldAt);
  return lotes.find((l) => l.start_date && l.end_date && l.start_date <= dia && dia <= l.end_date)?.name ?? null;
}

// Cadastro carregado uma vez (provedor no layout), por evento.
let CALENDARIO: Record<string, BatchDates[]> = {};
let EVENTO_ATUAL = "";
export function setBatchCalendar(porEvento: Record<string, BatchDates[]>) {
  CALENDARIO = porEvento;
}
export function setCurrentBatchEvent(eventId: string) {
  EVENTO_ATUAL = eventId;
}
export function batchCalendar(eventId = EVENTO_ATUAL): BatchDates[] {
  return ordenados(CALENDARIO[eventId] ?? []);
}
