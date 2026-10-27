import { addDays, format, isWeekend, startOfDay } from "date-fns";

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), base da Sexta-feira Santa.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados nacionais oficiais. Carnaval e Corpus Christi são ponto facultativo e contam como dia útil.
const FIXED_HOLIDAYS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

const holidayCache = new Map<number, Set<string>>();

function holidaysOf(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(FIXED_HOLIDAYS.map((md) => `${year}-${md}`));
    set.add(format(addDays(easterSunday(year), -2), "yyyy-MM-dd")); // Sexta-feira Santa
    holidayCache.set(year, set);
  }
  return set;
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !holidaysOf(date.getFullYear()).has(format(date, "yyyy-MM-dd"));
}

// Dias úteis de `from` até `to`, incluindo os dois extremos.
export function businessDaysBetween(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    if (isBusinessDay(d)) days.push(d);
  }
  return days;
}

// Os últimos `count` dias úteis antes de `before` (sem incluir o próprio dia).
export function lastBusinessDays(before: Date, count: number): Date[] {
  const days: Date[] = [];
  for (let d = addDays(startOfDay(before), -1); days.length < count; d = addDays(d, -1)) {
    if (isBusinessDay(d)) days.unshift(d);
  }
  return days;
}
