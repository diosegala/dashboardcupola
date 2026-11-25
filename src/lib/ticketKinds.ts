// Tipo do ingresso a partir do nome cadastrado na Sympla. O nome muda a cada lote e evento
// ("Lote 7 | Combo VIP (20, 21 e 22/05)"), mas o tipo é sempre um destes.

export const TICKET_KINDS = ["Padrão", "VIP", "Padrão Combo", "VIP Combo", "Grupo", "Visita presencial", "Credenciais"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

// Credenciais sem nível de acesso no nome (equipe, expositores, imprensa...).
const CREDENCIAIS = /\b(staff|expositor|palestrante|producao|imprensa|filmmaker|acompanhante)/;

const normaliza = (name: string | null | undefined) =>
  (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Tipo reconhecido por uma palavra explícita no nome; null quando nenhuma regra se aplica
// (produto novo ou renomeado na Sympla). O painel avisa esses casos em vez de adivinhar.
export function knownTicketKind(name: string | null | undefined): TicketKind | null {
  const n = normaliza(name);
  const vip = /\bvip\b/.test(n);
  // Combo: o nome muda entre lotes e versões da API ("Combo Padrão", "Padrão + Visita", "VIP + Visita").
  if (/\bcombo\b|\+\s*visita/.test(n)) return vip ? "VIP Combo" : "Padrão Combo";
  // Grupo: "Grupo", "Ingressos em grupos" ou faixa de quantidade ("2 a 5 Ingressos Padrão", "a partir de 3").
  if (/\bgrupos?\b|\b\d+\s*a\s*\d+\s*(ingressos\b|-)|a partir de \d+/.test(n)) return "Grupo";
  // Visita avulsa: só a visita, sem ingresso do evento ("Visita (dia 19)", "Visita presencial").
  if (/\bvisitas?\b/.test(n) && !vip && !/padrao|ingresso/.test(n)) return "Visita presencial";
  if (vip) return "VIP";
  if (CREDENCIAIS.test(n) && !/padrao/.test(n)) return "Credenciais";
  if (/padrao|ingresso summit/.test(n)) return "Padrão";
  return null;
}

// Para as contas, um nome não reconhecido segue como Padrão (e aparece no aviso de produto sem classificação).
export function ticketKind(name: string | null | undefined): TicketKind {
  return knownTicketKind(name) ?? "Padrão";
}

// Nomes de produto da Sympla que nenhuma regra reconhece, com a quantidade vendida.
export function unclassifiedProducts(tickets: { ticket_type?: string | null; source?: string; quantity?: number | null }[]) {
  const mapa = new Map<string, number>();
  tickets.forEach((t) => {
    if (t.source === "pipedrive" || !t.ticket_type || knownTicketKind(t.ticket_type)) return;
    mapa.set(t.ticket_type, (mapa.get(t.ticket_type) ?? 0) + (t.quantity || 0));
  });
  return Array.from(mapa, ([nome, quantidade]) => ({ nome, quantidade }));
}
