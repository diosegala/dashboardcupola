import type { Ticket } from "@/hooks/useCommercialMetrics";
import { normalizeCode, parseCoupon, personBySeller } from "@/lib/coupons";

// Canais do planejamento, na ordem do card. "Sem canal identificado" fica fora das metas.
export const CANAIS = [
  "BDR",
  "Anúncios",
  "Equipe CUPOLA",
  "Imobi Report",
  "E-mail marketing",
  "Patrocinadores",
  "Instagram Rodrigo",
  "Redes sociais",
] as const;
export const SEM_CANAL = "Sem canal identificado";

// Nomes antigos digitados nas metas que caem num canal novo.
const APELIDOS: Record<string, string> = {
  "meta ads": "Anúncios", "google ads": "Anúncios", anuncios: "Anúncios", "anúncios": "Anúncios", midia: "Anúncios",
  instagram: "Redes sociais", whatsapp: "Redes sociais", linkedin: "Redes sociais", "redes sociais": "Redes sociais",
  email: "E-mail marketing", "e-mail": "E-mail marketing", "rd station": "E-mail marketing",
  patrocinador: "Patrocinadores", equipe: "Equipe CUPOLA",
};
export function canalDaMeta(nome: string | null | undefined): string | null {
  const t = (nome ?? "").trim().toLowerCase();
  if (!t) return null;
  const fixo = CANAIS.find((c) => c.toLowerCase() === t);
  return fixo ?? APELIDOS[t] ?? null;
}

// UTM às vezes vem como códigos de letra ("{98,100,114}"): volta para texto minúsculo.
function texto(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  const codes = t.match(/^[({[]?\s*(\d{2,3}(?:\s*,\s*\d{2,3})+)\s*[)}\]]?$/);
  return (codes ? String.fromCharCode(...codes[1].split(",").map((n) => Number(n.trim()))) : t).trim().toLowerCase();
}

// Cupom da Letícia Bello em qualquer variação (LETICIAC5, LETICIA10, LEITICIA10…), menos LETICIAA5 (outra Letícia).
export function cupomBello(code: string | null | undefined): boolean {
  const c = normalizeCode(code ?? "");
  return /^LEI?TICIA/.test(c) && !/^LETICIAA/.test(c);
}

function vendedorBello(seller: unknown): boolean {
  const s = String(seller ?? "").toLowerCase();
  if (/bello/.test(s) || /^leticia\s*(c|10|15)?$/.test(s.trim())) return true;
  return !!personBySeller(seller)?.codes.some(cupomBello);
}

// Canal pelo link parametrizado; null quando o link não identifica canal.
function canalDoLink(source: string, medium: string): string | null {
  const ambos = `${source} ${medium}`;
  if (!source && !medium) return null;
  if (/bdr/.test(ambos) || cupomBello(source)) return "BDR";
  if (medium === "timecupola") return "Equipe CUPOLA";
  if (/imobi/.test(ambos)) return "Imobi Report";
  if (/patrocin/.test(ambos)) return "Patrocinadores";
  if (/(^|\s)(rd[-\s]?station|rd|e-?mail)/.test(ambos)) return "E-mail marketing";
  if (/rodrigo/.test(medium) && /(instagram|^ig$)/.test(source)) return "Instagram Rodrigo";
  if (/(meta|facebook|fb|google|ads|cpc|paid)/.test(ambos)) return "Anúncios";
  if (/(instagram|^ig$|whats|linkedin)/.test(source)) return "Redes sociais";
  return null;
}

// Regras de atribuição: faturado → link → cupom → sem canal.
export function canalDe(t: Ticket): string {
  if (t.source === "pipedrive") return vendedorBello(t.seller ?? t.seller_name) ? "BDR" : "Equipe CUPOLA";
  const doLink = canalDoLink(texto(t.utm_source), texto(t.utm_medium));
  if (doLink) return doLink;
  if (t.coupon_code) {
    if (cupomBello(t.coupon_code)) return "BDR";
    if (parseCoupon(t.coupon_code)?.group === "equipe") return "Equipe CUPOLA";
  }
  return SEM_CANAL;
}

// Ingressos e valor por canal (recebe só pagantes), sempre com todos os canais na ordem fixa.
export function vendasPorCanal(pagantes: Ticket[]) {
  const map = new Map<string, { value: number; amount: number }>();
  [...CANAIS, SEM_CANAL].forEach((c) => map.set(c, { value: 0, amount: 0 }));
  pagantes.forEach((t) => {
    const c = map.get(canalDe(t))!;
    c.value += t.quantity || 0;
    c.amount += Number(t.total_price || 0);
  });
  return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }));
}

// Meta do canal no lote (ou soma dos lotes em Evento todo); null quando não há meta.
export function metaDoCanal(goals: any[], canal: string, lote: string | null, batchOf: (s: string | null | undefined) => string | null): number | null {
  const doCanal = goals.filter((g) => g.metric_key === "channel_sales" && canalDaMeta(g.quota_key) === canal && (lote === null || batchOf(g.ticket_type) === lote));
  return doCanal.length ? doCanal.reduce((s, g) => s + Number(g.target_value || 0), 0) : null;
}
