// Tipo do ingresso a partir do nome cadastrado na Sympla. O nome muda a cada lote e evento
// ("Lote 7 | Combo VIP (20, 21 e 22/05)"), mas o tipo é sempre um destes.

export const TICKET_KINDS = ["Padrão", "VIP", "Padrão Combo", "VIP Combo", "Grupo", "Visita presencial", "Credenciais"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

// Credenciais sem nível de acesso no nome (equipe, expositores, imprensa...).
const CREDENCIAIS = /\b(staff|expositor|palestrante|producao|imprensa|filmmaker|acompanhante)/;

export function ticketKind(name: string | null | undefined): TicketKind {
  const n = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const vip = /\bvip\b/.test(n);
  // Combo: o nome muda entre lotes e versões da API ("Combo Padrão", "Padrão + Visita").
  if (/\bcombo\b|\+\s*visita/.test(n)) return vip ? "VIP Combo" : "Padrão Combo";
  // Grupo: "Grupo", "Ingressos em grupos" ou faixa de quantidade ("2 a 5 Ingressos Padrão", "10% OFF - 2 a 5 - Padrão").
  if (/\bgrupos?\b|\b\d+\s*a\s*\d+\s*(ingressos\b|-)/.test(n)) return "Grupo";
  if (/visita presencial/.test(n) && !/ingresso/.test(n)) return "Visita presencial";
  if (vip) return "VIP";
  if (CREDENCIAIS.test(n) && !/padrao/.test(n)) return "Credenciais";
  return "Padrão";
}
