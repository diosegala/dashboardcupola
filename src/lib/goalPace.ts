import { parseISO, startOfDay } from "date-fns";
import { businessDaysBetween } from "@/lib/businessDays";
import type { ChipVariant } from "@/components/Chip";

export interface GoalPace {
  label: string;
  variant: ChipVariant;
  // Quanto já deveria ter sido feito até hoje, pela fração de dias úteis decorridos do período da meta.
  expected: number;
}

// Situação da meta comparando o realizado com o esperado para o tempo decorrido (sem projeção).
export function goalPace(actual: number, target: number, periodStart: string, periodEnd: string, today = new Date()): GoalPace | null {
  if (!(target > 0)) return null;
  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);
  const now = startOfDay(today);

  if (actual >= target) return { label: "Meta atingida", variant: "paid", expected: target };
  if (now < start) return { label: "Não iniciada", variant: "neutral", expected: 0 };

  const total = Math.max(businessDaysBetween(start, end).length, 1);
  const elapsed = now > end ? total : businessDaysBetween(start, now).length;
  const expected = (target * elapsed) / total;

  if (now > end) return { label: "Não atingida", variant: "bad", expected: target };
  if (actual >= expected * 1.1) return { label: "Acima do esperado", variant: "ok", expected };
  if (actual >= expected) return { label: "No ritmo", variant: "ok", expected };
  return { label: "Abaixo do esperado", variant: "warn", expected };
}
