// Parâmetros do CUPOLA Summit 2027. Na fase de vários eventos isso passa a vir do cadastro do evento.
export const EVENT_NAME = "CUPOLA Summit 2027";
export const EVENT_DATE = new Date(2027, 4, 19); // 19/05/2027, abertura do evento

// Meta global de pagantes: vem da tela Metas (métrica "paying_tickets"); 2.000 é o valor decidido em 27/10/2026.
export const PAYING_GOAL_KEY = "paying_tickets";
export const PAYING_GOAL_DEFAULT = 2000;

// Ritmo atual = média dos últimos N dias úteis.
export const CURRENT_PACE_DAYS = 10;

// Cupons que marcam ingressos faturados internamente (sem hífen).
export const INVOICED_COUPON_PREFIX = "FATURADO";

// Status da Sympla que contam como venda concluída.
export function isApproved(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "approved";
}
