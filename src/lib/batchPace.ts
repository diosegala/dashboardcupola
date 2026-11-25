// Ritmo de vendas por seleção (um lote do calendário ou o evento todo), em pagantes por dia útil.
// Pura: recebe as vendas pagantes, as datas e o dia de hoje (Brasília). Regra de dias úteis: businessDaysBetween.
import { businessDaysBetween } from "@/lib/businessDays";
import { diaBrasilia, type BatchDates } from "@/lib/batchCalendar";

export type VisaoRitmo = "ate_hoje" | "total";
export interface VendaPagante { sold_at?: string | null; quantity?: number | null }

const data = (dia: string) => { const [y, m, d] = dia.split("-").map(Number); return new Date(y, m - 1, d); };
const diasUteis = (de: string, ate: string) => (de > ate ? 0 : businessDaysBetween(data(de), data(ate)).length);

export interface RitmoPeriodo {
  situacao: "nao_iniciado" | "andamento" | "encerrado";
  pagantes: number;
  dias: number;
  ritmo: number | null;
  // Dias úteis de hoje até o fim (para o ritmo necessário).
  diasRestantes: number;
}

// Núcleo genérico: qualquer recorte de datas de calendário (serve também para o mesmo período do ano anterior).
// `todas`: conta todas as vendas pagas recebidas, sem filtrar por data (Evento todo nunca descarta venda fora de lote).
export function ritmoNoPeriodo(vendas: VendaPagante[], inicio: string, fim: string, hoje: string, visao: VisaoRitmo, todas = false): RitmoPeriodo {
  const pagantes = vendas.reduce((s, v) => {
    if (todas) return s + (v.quantity || 0);
    if (!v.sold_at) return s;
    const dia = diaBrasilia(v.sold_at);
    return dia >= inicio && dia <= fim && dia <= hoje ? s + (v.quantity || 0) : s;
  }, 0);
  const situacao = hoje < inicio ? "nao_iniciado" : hoje > fim ? "encerrado" : "andamento";
  const ateDia = visao === "total" || situacao === "encerrado" ? fim : hoje;
  const dias = situacao === "nao_iniciado" ? 0 : diasUteis(inicio, ateDia);
  const ritmo = situacao === "nao_iniciado" ? null : dias > 0 ? pagantes / dias : pagantes;
  const diasRestantes = situacao === "encerrado" ? 0 : diasUteis(hoje > inicio ? hoje : inicio, fim);
  return { situacao, pagantes, dias, ritmo, diasRestantes };
}

// Opções do ritmo, em ordem cronológica: só lotes já iniciados e sem repetir período (datas sobrepostas ficam com o primeiro).
export function lotesDoRitmo(lotes: BatchDates[], hoje: string): BatchDates[] {
  const ordem = [...lotes].sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0) || (x.start_date ?? "").localeCompare(y.start_date ?? ""));
  const aceitos: BatchDates[] = [];
  for (const l of ordem) {
    if (!l.start_date || !l.end_date || l.start_date > hoje) continue;
    if (aceitos.some((a) => l.start_date! <= a.end_date! && a.start_date! <= l.end_date!)) continue;
    aceitos.push(l);
  }
  return aceitos;
}

// Ritmo necessário: o que falta da meta ÷ dias úteis que faltam na seleção.
export function ritmoNecessario(meta: number | null, pagantes: number, diasRestantes: number): { necessario: number | null; faltam: number } {
  if (meta === null || meta <= 0) return { necessario: null, faltam: 0 };
  const faltam = Math.max(meta - pagantes, 0);
  return { necessario: diasRestantes > 0 ? faltam / diasRestantes : 0, faltam };
}

// Situação do ritmo frente ao necessário (mesma régua do evento: +10% = acima).
export function statusDoRitmo(ritmo: number | null, necessario: number | null, faltam: number): "achieved" | "above" | "on_track" | "below" | null {
  if (ritmo === null || necessario === null) return null;
  if (faltam === 0) return "achieved";
  if (ritmo >= necessario * 1.1) return "above";
  if (ritmo >= necessario) return "on_track";
  return "below";
}

// Marco inicial do Evento todo: dia (Brasília) da venda paga mais antiga. Sem vendas datadas: null.
export function marcoInicial(vendas: VendaPagante[]): string | null {
  let m: string | null = null;
  for (const v of vendas) {
    if (!v.sold_at || !(v.quantity || 0)) continue;
    const d = diaBrasilia(v.sold_at);
    if (m === null || d < m) m = d;
  }
  return m;
}

// Pagantes fora de qualquer lote cadastrado (sem data ou com data fora de todos os períodos).
// `inicio`/`fim` opcionais limitam ao recorte (Período filtrado).
export function pagantesForaDeLote(vendas: VendaPagante[], lotes: BatchDates[], inicio?: string, fim?: string): number {
  return vendas.reduce((s, v) => {
    if (!v.sold_at) return inicio ? s : s + (v.quantity || 0);
    const d = diaBrasilia(v.sold_at);
    if (inicio && (d < inicio || (fim && d > fim))) return s;
    const dentro = lotes.some((l) => l.start_date && l.end_date && l.start_date <= d && d <= l.end_date);
    return dentro ? s : s + (v.quantity || 0);
  }, 0);
}

// Dia de calendário deslocado (AAAA-MM-DD), sem fuso.
export function somarDias(dia: string, n: number): string {
  const d = data(dia);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lote imediatamente anterior na lista do ritmo; o primeiro não tem anterior (null).
export function loteAnterior(opcoes: BatchDates[], nome: string): BatchDates | null {
  const i = opcoes.findIndex((o) => o.name === nome);
  return i > 0 ? opcoes[i - 1] : null;
}

// Nível de urgência do ritmo: quanto do necessário o ritmo atual cobre.
// ≥100% no ritmo · 80–99% atenção · 50–79% risco · <50% crítico.
export type NivelRitmo = "meta" | "ok" | "atencao" | "risco" | "critico";
export function nivelDoRitmo(ritmo: number | null, necessario: number | null, faltam: number): NivelRitmo | null {
  if (ritmo === null || necessario === null) return null;
  if (faltam === 0) return "meta";
  if (necessario <= 0) return "ok";
  const p = ritmo / necessario;
  if (p >= 1) return "ok";
  if (p >= 0.8) return "atencao";
  if (p >= 0.5) return "risco";
  return "critico";
}
