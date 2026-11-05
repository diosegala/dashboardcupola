import { endOfDay, startOfDay, subYears } from "date-fns";
import type { DateRange } from "@/hooks/useDashboardData";

// A Sympla manda a data da venda no horário de Brasília sem fuso ("2026-11-04 08:36:41") e o banco guarda como se
// fosse UTC. Lê o relógio de parede e devolve o instante certo (Brasília é UTC-3 o ano todo desde 2019).
export function normalizeSoldAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const wall = String(value).trim().replace(" ", "T").slice(0, 19);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(wall)) return String(value);
  const d = new Date(`${wall}-03:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export function withSaleDate<T extends { sold_at?: string | null }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, sold_at: normalizeSoldAt(r.sold_at) }));
}

// Data só com dia ("2026-05-01") é o dia inteiro no horário local; com hora, o instante.
export function parseDay(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function inPeriod(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const d = parseDay(value);
  return d >= startOfDay(range.from) && d <= endOfDay(range.to);
}

export function ticketsInPeriod<T extends { sold_at?: string | null }>(tickets: T[], range: DateRange): T[] {
  return tickets.filter((t) => inPeriod(t.sold_at, range));
}

// O mesmo período um ano antes, para comparar com o evento anterior.
export function previousYear(range: DateRange): DateRange {
  return { from: subYears(range.from, 1), to: subYears(range.to, 1) };
}

// O período cobre todas as vendas do evento (da primeira venda até hoje)?
export function coversWholeEvent<T extends { sold_at?: string | null }>(range: DateRange, tickets: T[], now = new Date()): boolean {
  const first = tickets.reduce<string | null>((min, t) => (t.sold_at && (!min || t.sold_at < min) ? t.sold_at : min), null);
  const start = first ? startOfDay(new Date(first)) : startOfDay(now);
  return startOfDay(range.from) <= start && endOfDay(range.to) >= startOfDay(now);
}
