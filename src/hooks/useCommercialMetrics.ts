import { useMemo } from "react";
import { addDays, addYears, differenceInCalendarWeeks, endOfWeek, format, startOfDay, startOfWeek, subYears } from "date-fns";
import { businessDaysBetween, lastBusinessDays } from "@/lib/businessDays";
import { parseCoupon } from "@/lib/coupons";
import { ticketCategory } from "@/lib/ticketCategory";
import { eventGoal } from "@/lib/goalMetrics";
import {
  CURRENT_PACE_DAYS,
  EVENT_DATE,
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
  // Faturados internamente vêm do Pipedrive (negócio ganho); o resto vem da Sympla.
  source?: "sympla" | "pipedrive";
  seller?: string | null;
  seller_name?: string | null;
  deal_id?: string;
  deal_title?: string | null;
  // Negócio aberto: etapa no funil (ex.: Fechamento). Empresa do negócio, para casar com o cupom de resgate.
  stage_name?: string | null;
  company?: string | null;
  // Venda lida pelo título ou com quantidades diferentes entre título e produtos.
  conferir?: string | null;
  // Resgate na Sympla de um faturado: id do negócio no Pipedrive (não conta como venda nem cortesia).
  redeems?: string | null;
  // Desconto em R$ dado no negócio do Pipedrive (linha do produto), quando preenchido.
  discount_value?: number;
}

const qty = (t: Ticket) => t.quantity || 0;
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// Separa as vendas aprovadas em pagos na Sympla, faturados (negócios ganhos no Pipedrive) e bonificados (cortesias, credenciais, gratuitos).
export function splitTickets(tickets: Ticket[]) {
    const approved = tickets.filter((t) => isApproved(t.status));
    const cat = (t: Ticket) => ticketCategory(t);
    const invoiced = approved.filter((t) => cat(t) === "faturados");
    // Pagos na Sympla: com valor, sem cupom 100% e fora das credenciais (com ou sem cupom de desconto).
    const paidSympla = approved.filter((t) => cat(t) === "pagos" || cat(t) === "desconto");
    // Bonificados: não somam na meta nem na receita.
    const bonus = approved.filter((t) => ["cortesias", "credenciais", "gratuitos"].includes(cat(t)));
    const paying = [...paidSympla, ...invoiced];
    return { paidSympla, invoiced, bonus, paying };
}

// Indicadores da aba Comercial, sempre sobre todas as vendas do evento atual (não dependem do período).
export interface EventParams {
  // Abertura do evento: fim da contagem de dias úteis.
  eventDate: Date;
}

export function useCommercialMetrics(
  tickets: Ticket[],
  goals: any[],
  previousTickets: Ticket[] = [],
  { eventDate }: EventParams = { eventDate: EVENT_DATE },
) {
  return useMemo(() => {
    const today = startOfDay(new Date());
    const { paidSympla, invoiced, bonus, paying } = splitTickets(tickets);

    const paidSymplaCount = paidSympla.reduce((s, t) => s + qty(t), 0);
    const invoicedCount = invoiced.reduce((s, t) => s + qty(t), 0);
    const bonusCount = bonus.reduce((s, t) => s + qty(t), 0);
    const payingCount = paidSymplaCount + invoicedCount;
    const revenue = paying.reduce((s, t) => s + Number(t.total_price || 0), 0);

    // Meta de pagantes só existe se foi definida na tela Metas; sem ela, nada de meta aparece nos gráficos.
    const goalRow = eventGoal(goals, PAYING_GOAL_KEY);
    const goal: number | null = goalRow && Number(goalRow.target_value) > 0 ? Number(goalRow.target_value) : null;
    const missing = goal !== null ? Math.max(goal - payingCount, 0) : 0;

    // Ritmo necessário: o que falta dividido pelos dias úteis de hoje até a véspera do evento.
    const remainingDays = businessDaysBetween(today, addDays(eventDate, -1)).length;
    const requiredPace: number | null = goal === null ? null : remainingDays > 0 ? missing / remainingDays : 0;

    // Vendas pagantes por dia.
    const byDay = new Map<string, number>();
    const revByDay = new Map<string, number>();
    // A parte faturada internamente (Pipedrive), para os gráficos mostrarem quanto do total veio de cada fonte.
    const internoByDay = new Map<string, number>();
    const revInternoByDay = new Map<string, number>();
    paying.forEach((t) => {
      if (!t.sold_at) return;
      const k = dayKey(new Date(t.sold_at));
      byDay.set(k, (byDay.get(k) || 0) + qty(t));
      revByDay.set(k, (revByDay.get(k) || 0) + Number(t.total_price || 0));
      if (t.source === "pipedrive") {
        internoByDay.set(k, (internoByDay.get(k) || 0) + qty(t));
        revInternoByDay.set(k, (revInternoByDay.get(k) || 0) + Number(t.total_price || 0));
      }
    });
    const ate = (mapa: Map<string, number>, endKey: string) => Array.from(mapa.entries()).filter(([d]) => d <= endKey).reduce((s, [, v]) => s + v, 0);

    // Ritmo atual: média dos últimos dias úteis completos.
    const paceDays = lastBusinessDays(today, CURRENT_PACE_DAYS);
    const currentPace = paceDays.reduce((s, d) => s + (byDay.get(dayKey(d)) || 0), 0) / CURRENT_PACE_DAYS;

    let paceStatus: PaceStatus | null = null;
    if (goal !== null && requiredPace !== null) {
      if (missing === 0) paceStatus = "achieved";
      else if (currentPace >= requiredPace * 1.1) paceStatus = "above";
      else if (currentPace >= requiredPace) paceStatus = "on_track";
      else paceStatus = "below";
    }

    // Vendas por dia útil: últimos 15 dias úteis comparados ao ritmo necessário.
    const dailyBusiness = lastBusinessDays(today, 15).map((d) => {
      const value = byDay.get(dayKey(d)) || 0;
      return { date: dayKey(d), label: format(d, "dd/MM"), pagantes: value, onPace: requiredPace === null || value >= requiredPace };
    });

    // Pagantes acumulados por semana, da primeira venda até o evento, com a trajetória linear (dias úteis) até a meta.
    const saleDates = paying.map((t) => t.sold_at).filter(Boolean).sort() as string[];
    const start = saleDates.length ? startOfDay(new Date(saleDates[0])) : today;
    const lastDayBeforeEvent = addDays(eventDate, -1);
    const totalBusiness = Math.max(businessDaysBetween(start, lastDayBeforeEvent).length, 1);
    const weekCount = differenceInCalendarWeeks(eventDate, start, { weekStartsOn: 1 }) + 1;
    const sortedDays = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const previousPaying = splitTickets(previousTickets).paying;
    const previousDays = previousPaying
      .filter((t) => t.sold_at)
      .map((t) => [dayKey(addYears(new Date(t.sold_at as string), 1)), qty(t)] as const);
    const hasPrevious = previousDays.length > 0;
    // Receita: meta de receita da tela Metas (única fonte) e receita do ano anterior por dia.
    const revGoalRow = eventGoal(goals, "revenue");
    const revenueGoal: number | null = revGoalRow && Number(revGoalRow.target_value) > 0 ? Number(revGoalRow.target_value) : null;
    const sortedRevDays = Array.from(revByDay.entries());
    const previousRevDays = previousPaying
      .filter((t) => t.sold_at)
      .map((t) => [dayKey(addYears(new Date(t.sold_at as string), 1)), Number(t.total_price || 0)] as const);
    const weekly = Array.from({ length: Math.max(weekCount, 1) }, (_, i) => {
      const weekStart = startOfWeek(addDays(start, i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const limit = weekEnd < lastDayBeforeEvent ? weekEnd : lastDayBeforeEvent;
      const endKey = dayKey(limit);
      const cumulative = sortedDays.filter(([d]) => d <= endKey).reduce((s, [, v]) => s + v, 0);
      const interno = ate(internoByDay, endKey);
      const trajectory = goal !== null ? Math.round((goal * businessDaysBetween(start, limit).length) / totalBusiness) : null;
      return {
        label: `S${i + 1}`,
        weekStart: dayKey(weekStart),
        pagantes: weekStart <= today ? cumulative : null,
        sympla: weekStart <= today ? cumulative - interno : null,
        interno: weekStart <= today ? interno : null,
        ...(trajectory !== null ? { trajetoria: trajectory } : {}),
        ...(hasPrevious ? { anoAnterior: previousDays.filter(([d]) => d <= endKey).reduce((s, [, v]) => s + v, 0) } : {}),
      };
    });
    // Receita acumulada por semana, no mesmo eixo do gráfico de pagantes.
    const weeklyRevenue = weekly.map((w, i) => {
      const weekStart = new Date(`${w.weekStart}T12:00:00`);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const limit = weekEnd < lastDayBeforeEvent ? weekEnd : lastDayBeforeEvent;
      const endKey = dayKey(limit);
      const sum = (arr: readonly (readonly [string, number])[]) => arr.filter(([d]) => d <= endKey).reduce((s, [, v]) => s + v, 0);
      return {
        label: `S${i + 1}`,
        receita: startOfDay(weekStart) <= today ? sum(sortedRevDays) : null,
        receitaSympla: startOfDay(weekStart) <= today ? sum(sortedRevDays) - ate(revInternoByDay, endKey) : null,
        receitaInterno: startOfDay(weekStart) <= today ? ate(revInternoByDay, endKey) : null,
        ...(revenueGoal !== null ? { trajetoria: Math.round((revenueGoal * businessDaysBetween(start, limit).length) / totalBusiness) } : {}),
        ...(hasPrevious ? { anoAnterior: sum(previousRevDays) } : {}),
      };
    });

    // Evento anterior no mesmo ponto: tudo o que ele tinha até a mesma data, um ano antes.
    const umAnoAntes = subYears(today, 1);
    const limiteAnterior = dayKey(umAnoAntes);
    const anteriores = splitTickets(previousTickets);
    const ateMesmaData = (lista: Ticket[]) => lista.filter((t) => t.sold_at && dayKey(new Date(t.sold_at)) <= limiteAnterior);
    const prevPaying = ateMesmaData(anteriores.paying);
    const prevByDay = new Map<string, number>();
    anteriores.paying.forEach((t) => {
      if (!t.sold_at) return;
      const k = dayKey(new Date(t.sold_at));
      prevByDay.set(k, (prevByDay.get(k) || 0) + qty(t));
    });
    const prevPaceDays = lastBusinessDays(umAnoAntes, CURRENT_PACE_DAYS);
    const anterior = hasPrevious
      ? {
          payingCount: prevPaying.reduce((s, t) => s + qty(t), 0),
          revenue: prevPaying.reduce((s, t) => s + Number(t.total_price || 0), 0),
          issuedCount: [...anteriores.paying, ...anteriores.bonus].filter((t) => t.sold_at && dayKey(new Date(t.sold_at)) <= limiteAnterior).reduce((s, t) => s + qty(t), 0),
          currentPace: prevPaceDays.reduce((s, d) => s + (prevByDay.get(dayKey(d)) || 0), 0) / CURRENT_PACE_DAYS,
          // Vendas pagantes por dia, já na data equivalente deste ano (aaaa-mm-dd).
          paidByDay: Object.fromEntries(Array.from(prevByDay.entries()).map(([d, v]) => [dayKey(addYears(new Date(`${d}T12:00:00`), 1)), v])),
        }
      : null;

    return {
      goal,
      hasGoalRow: !!goalRow,
      anterior,
      payingCount,
      paidSymplaCount,
      invoicedCount,
      bonusCount,
      missing,
      revenue,
      progress: goal ? Math.min(payingCount / goal, 1) : 0,
      remainingDays,
      requiredPace,
      currentPace,
      paceStatus,
      dailyBusiness,
      // Vendas pagantes por dia (aaaa-mm-dd) e a data da primeira venda, para navegar pelos dias úteis.
      paidByDay: Object.fromEntries(byDay),
      internoByDay: Object.fromEntries(internoByDay),
      firstSaleDate: start,
      weekly,
      weeklyRevenue,
      revenueGoal,
      hasPrevious,
      issuedCount: paidSymplaCount + invoicedCount + bonusCount,
    };
  }, [tickets, goals, previousTickets, eventDate]);
}
