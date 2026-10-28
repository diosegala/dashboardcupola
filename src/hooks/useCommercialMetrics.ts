import { useMemo } from "react";
import { addDays, differenceInCalendarWeeks, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { businessDaysBetween, lastBusinessDays } from "@/lib/businessDays";
import { parseCoupon } from "@/lib/coupons";
import {
  CURRENT_PACE_DAYS,
  EVENT_DATE,
  PAYING_GOAL_DEFAULT,
  PAYING_GOAL_KEY,
  isApproved,
} from "@/lib/eventConfig";

export type PaceStatus = "achieved" | "above" | "on_track" | "below";

export interface Ticket {
  quantity: number | null;
  total_price: number | string | null;
  unit_price: number | string | null;
  sold_at: string | null;
  status: string | null;
  coupon_code?: string | null;
  ticket_type?: string | null;
  buyer_state?: string | null;
  company_size?: string | null;
  payment_method?: string | null;
  utm_source?: string | null;
}

const qty = (t: Ticket) => t.quantity || 0;
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// Separa as vendas aprovadas em pagos na Sympla, faturados (cupom FATURADO) e bonificados (valor zero).
export function splitTickets(tickets: Ticket[], minTicketPrice: number) {
    const approved = tickets.filter((t) => isApproved(t.status));
    const invoiced = approved.filter((t) => parseCoupon(t.coupon_code)?.kind === "faturado");
    const notInvoiced = approved.filter((t) => !invoiced.includes(t));
    // Pagos na Sympla: aprovados, com valor acima de zero e do valor mínimo configurado.
    const paidSympla = notInvoiced.filter((t) => {
      const price = Number(t.unit_price ?? t.total_price ?? 0);
      return price > 0 && price >= minTicketPrice;
    });
    // Bonificados: aprovados sem valor (cortesias, expositores, patrocinadores). Não somam na meta nem na receita.
    const bonus = notInvoiced.filter((t) => Number(t.unit_price ?? t.total_price ?? 0) === 0);
    const paying = [...paidSympla, ...invoiced];
    return { paidSympla, invoiced, bonus, paying };
}

// Indicadores da aba Comercial, sempre sobre todas as vendas do evento atual (não dependem do período).
export function useCommercialMetrics(tickets: Ticket[], goals: any[], minTicketPrice: number) {
  return useMemo(() => {
    const today = startOfDay(new Date());
    const { paidSympla, invoiced, bonus, paying } = splitTickets(tickets, minTicketPrice);

    const paidSymplaCount = paidSympla.reduce((s, t) => s + qty(t), 0);
    const invoicedCount = invoiced.reduce((s, t) => s + qty(t), 0);
    const bonusCount = bonus.reduce((s, t) => s + qty(t), 0);
    const payingCount = paidSymplaCount + invoicedCount;
    const revenue = paying.reduce((s, t) => s + Number(t.total_price || 0), 0);

    const goalRow = goals
      .filter((g) => g.metric_key === PAYING_GOAL_KEY && !g.ticket_type)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    const goal = goalRow ? Number(goalRow.target_value) : PAYING_GOAL_DEFAULT;
    const missing = Math.max(goal - payingCount, 0);

    // Ritmo necessário: o que falta dividido pelos dias úteis de hoje até a véspera do evento.
    const remainingDays = businessDaysBetween(today, addDays(EVENT_DATE, -1)).length;
    const requiredPace = remainingDays > 0 ? missing / remainingDays : 0;

    // Vendas pagantes por dia.
    const byDay = new Map<string, number>();
    paying.forEach((t) => {
      if (!t.sold_at) return;
      const k = dayKey(new Date(t.sold_at));
      byDay.set(k, (byDay.get(k) || 0) + qty(t));
    });

    // Ritmo atual: média dos últimos dias úteis completos.
    const paceDays = lastBusinessDays(today, CURRENT_PACE_DAYS);
    const currentPace = paceDays.reduce((s, d) => s + (byDay.get(dayKey(d)) || 0), 0) / CURRENT_PACE_DAYS;

    let paceStatus: PaceStatus;
    if (missing === 0) paceStatus = "achieved";
    else if (currentPace >= requiredPace * 1.1) paceStatus = "above";
    else if (currentPace >= requiredPace) paceStatus = "on_track";
    else paceStatus = "below";

    // Vendas por dia útil: últimos 15 dias úteis comparados ao ritmo necessário.
    const dailyBusiness = lastBusinessDays(today, 15).map((d) => {
      const value = byDay.get(dayKey(d)) || 0;
      return { date: dayKey(d), label: format(d, "dd/MM"), pagantes: value, onPace: value >= requiredPace };
    });

    // Pagantes acumulados por semana, da primeira venda até o evento, com a trajetória linear (dias úteis) até a meta.
    const saleDates = paying.map((t) => t.sold_at).filter(Boolean).sort() as string[];
    const start = saleDates.length ? startOfDay(new Date(saleDates[0])) : today;
    const lastDayBeforeEvent = addDays(EVENT_DATE, -1);
    const totalBusiness = Math.max(businessDaysBetween(start, lastDayBeforeEvent).length, 1);
    const weekCount = differenceInCalendarWeeks(EVENT_DATE, start, { weekStartsOn: 1 }) + 1;
    const sortedDays = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const weekly = Array.from({ length: Math.max(weekCount, 1) }, (_, i) => {
      const weekStart = startOfWeek(addDays(start, i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const limit = weekEnd < lastDayBeforeEvent ? weekEnd : lastDayBeforeEvent;
      const endKey = dayKey(limit);
      const cumulative = sortedDays.filter(([d]) => d <= endKey).reduce((s, [, v]) => s + v, 0);
      const trajectory = Math.round((goal * businessDaysBetween(start, limit).length) / totalBusiness);
      return {
        label: `S${i + 1}`,
        weekStart: dayKey(weekStart),
        pagantes: weekStart <= today ? cumulative : null,
        trajetoria: trajectory,
      };
    });

    return {
      goal,
      hasGoalRow: !!goalRow,
      payingCount,
      paidSymplaCount,
      invoicedCount,
      bonusCount,
      missing,
      revenue,
      progress: goal > 0 ? Math.min(payingCount / goal, 1) : 0,
      remainingDays,
      requiredPace,
      currentPace,
      paceStatus,
      dailyBusiness,
      weekly,
      issuedCount: paidSymplaCount + invoicedCount + bonusCount,
    };
  }, [tickets, goals, minTicketPrice]);
}
