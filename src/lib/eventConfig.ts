// Parâmetros do CUPOLA Summit 2027. Na fase de vários eventos isso passa a vir do cadastro do evento.
export const EVENT_NAME = "CUPOLA Summit 2027";
export const EVENT_DATE = new Date(2027, 4, 19); // 19/05/2027, abertura do evento
export const EVENT_END_DATE = new Date(2027, 4, 21); // 21/05/2027, último dia; depois disso o painel mostra "Encerrado"

// Evento anterior guardado na base própria (tabela event_history), usado na linha "Ano anterior".
export const PREVIOUS_EVENT_KEY = "summit-2026";

// Meta global de pagantes: vem da tela Metas (métrica "paying_tickets"); 2.000 é o valor decidido em 27/10/2026.
export const PAYING_GOAL_KEY = "paying_tickets";

// Ritmo atual = média dos últimos N dias úteis.
export const CURRENT_PACE_DAYS = 10;

// Cupons que marcam ingressos faturados internamente (sem hífen).
export const INVOICED_COUPON_PREFIX = "FATURADO";

// Status da Sympla que contam como venda concluída.
export function isApproved(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "approved";
}
