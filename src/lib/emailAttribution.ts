// Liga vendas do canal E-mail marketing ao e-mail do RD Station que as gerou.
// O RD não informa os links de cada e-mail, então a ligação usa o utm_content do pedido:
// 1) código exato no começo do nome do e-mail → exata;
// 2) nome parecido + horário compatível → confiável; só nome parecido → provável;
// 3) só horário → apenas sugestão para o administrador (sem selo);
// decisões do administrador prevalecem sobre a suposição.

export type LinkLevel = "exata" | "confiavel" | "provavel" | "sugestao" | "sem";

export interface EmailRef {
  id: string; // rd_campaign_id
  name: string;
  sentAt: string | null; // ISO
}
export interface SaleRef {
  id: string;
  utmContent: string | null;
  soldAt: string | null; // ISO
}
export interface Decision {
  utm_content: string;
  rd_campaign_id: string | null; // null = sem ligação
}
export interface SaleLink {
  saleId: string;
  utmContent: string | null;
  emailId: string | null;
  level: LinkLevel;
  porNome: boolean;
  porHorario: boolean;
  decidido: boolean;
}

const JANELA_MS = 3 * 86400000;
const PEQUENAS = new Set(["de", "da", "do", "das", "dos", "e", "o", "a", "os", "as", "um", "uma", "seu", "sua", "seus", "suas", "no", "na", "nos", "nas", "em", "para", "pra", "por", "com", "que", "se", "te", "voce", "vc", "ass", "the"]);

export const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const raiz = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
const palavras = (s: string) =>
  fold(s)
    .replace(/\[[^\]]*\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !PEQUENAS.has(w))
    .map(raiz);

// Nome do e-mail começa com um código igual ao utm_content (ex.: "sum27-segredo-curadoria ...").
export function codigoExato(utm: string, nome: string): boolean {
  const c = slug(utm);
  if (!c) return false;
  const n = slug(nome);
  return n === c || n.startsWith(`${c}-`);
}

// Nome parecido: todas as palavras significativas do utm_content aparecem no nome,
// ou pelo menos 2 e 60% delas.
export function nomeParecido(utm: string, nome: string): boolean {
  const u = [...new Set(palavras(utm))].filter((w) => !/^\d+$/.test(w) || w.length > 1);
  if (!u.length) return false;
  const n = new Set(palavras(nome));
  const hits = u.filter((w) => n.has(w) || [...n].some((x) => x.length >= 5 && w.length >= 5 && (x.startsWith(w) || w.startsWith(x)))).length;
  return hits === u.length || (hits >= 2 && hits / u.length >= 0.6);
}

const ts = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

// E-mail enviado mais perto, e antes, do momento (até 3 dias).
function maisPertoAntes(emails: EmailRef[], quando: number): EmailRef | null {
  let melhor: EmailRef | null = null;
  for (const e of emails) {
    const t = ts(e.sentAt);
    if (!Number.isFinite(t) || t > quando || quando - t > JANELA_MS) continue;
    if (!melhor || t > ts(melhor.sentAt)) melhor = e;
  }
  return melhor;
}

export function linkSales(sales: SaleRef[], emails: EmailRef[], decisions: Decision[] = []): SaleLink[] {
  const dec = new Map(decisions.map((d) => [slug(d.utm_content), d]));
  const ids = new Set(emails.map((e) => e.id));
  // Primeira venda de cada utm_content (para a pista de horário).
  const primeira = new Map<string, number>();
  for (const s of sales) {
    const k = slug(s.utmContent ?? "");
    const t = ts(s.soldAt);
    if (!k || !Number.isFinite(t)) continue;
    if (!primeira.has(k) || t < primeira.get(k)!) primeira.set(k, t);
  }
  return sales.map((s): SaleLink => {
    const base = { saleId: s.id, utmContent: s.utmContent, porNome: false, porHorario: false, decidido: false };
    const k = slug(s.utmContent ?? "");
    if (!k) return { ...base, emailId: null, level: "sem" };
    const d = dec.get(k);
    if (d) {
      if (d.rd_campaign_id && ids.has(d.rd_campaign_id)) return { ...base, emailId: d.rd_campaign_id, level: "confiavel", decidido: true };
      if (!d.rd_campaign_id) return { ...base, emailId: null, level: "sem", decidido: true };
    }
    const exatos = emails.filter((e) => codigoExato(k, e.name));
    const quando = ts(s.soldAt);
    if (exatos.length) {
      const e = (Number.isFinite(quando) && maisPertoAntes(exatos, quando)) || exatos[0];
      return { ...base, emailId: e.id, level: "exata" };
    }
    const porNome = emails.filter((e) => nomeParecido(k, e.name));
    const pelaPrimeira = primeira.has(k) ? maisPertoAntes(emails, primeira.get(k)!) : null;
    if (porNome.length) {
      // Vários e-mails com nome compatível: cada venda vai para o compatível enviado mais perto, e antes, dela.
      const escolhido =
        (Number.isFinite(quando) && maisPertoAntes(porNome, quando)) ||
        [...porNome].sort((a, b) => ts(b.sentAt) - ts(a.sentAt))[0];
      const horarioConfirma = !!pelaPrimeira && (pelaPrimeira.id === escolhido.id || (Number.isFinite(quando) && maisPertoAntes(porNome, quando)?.id === escolhido.id && porNome.length > 1));
      return { ...base, emailId: escolhido.id, level: horarioConfirma ? "confiavel" : "provavel", porNome: true, porHorario: horarioConfirma };
    }
    if (pelaPrimeira) return { ...base, emailId: pelaPrimeira.id, level: "sugestao", porHorario: true };
    return { ...base, emailId: null, level: "sem" };
  });
}

// Nível que aparece no selo de um e-mail: o mais fraco entre as vendas exibidas (exata/confiável = normal).
export const levelRank: Record<LinkLevel, number> = { exata: 4, confiavel: 3, provavel: 2, sugestao: 1, sem: 0 };
export const showsBadge = (l: LinkLevel) => l === "exata" || l === "confiavel" || l === "provavel";
