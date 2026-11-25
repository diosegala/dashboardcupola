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
export function ritmoNoPeriodo(vendas: VendaPagante[], inicio: string, fim: string, hoje: string, visao: VisaoRitmo): RitmoPeriodo {
  const pagantes = vendas.reduce((s, v) => {
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

// Abas do ritmo: lotes já iniciados (até o vigente), sem repetir a mesma faixa de datas.
export function lotesDoRitmo(lotes: BatchDates[], hoje: string): BatchDates[] {
  const vistos = new Set<string>();
  return lotes.filter((l) => {
    if (!l.start_date || !l.end_date || l.start_date > hoje) return false;
    const chave = `${l.start_date}|${l.end_date}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
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
