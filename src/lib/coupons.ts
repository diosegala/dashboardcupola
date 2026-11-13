import { INVOICED_COUPON_PREFIX } from "@/lib/eventConfig";

export type CouponKind = "faturado" | "cortesia" | "desconto";

// Para que serve o cupom.
export type CouponGroup = "faturado" | "resgate" | "palestrante" | "equipe" | "parceiro";

export const COUPON_GROUPS: { key: CouponGroup; label: string }[] = [
  { key: "faturado", label: "Faturados" },
  { key: "resgate", label: "Resgate" },
  { key: "palestrante", label: "Palestrantes" },
  { key: "equipe", label: "Equipe CUPOLA" },
  { key: "parceiro", label: "Parceiros e outros" },
];

// Cupons da equipe: nome da pessoa + o número do desconto da equipe (ex.: EMILLYN5 com 5%).
export const TEAM_DISCOUNT = 5;
const TEAM_CODE = new RegExp(`^[A-Z]{3,}${TEAM_DISCOUNT}$`);

// Pessoas com mais de um cupom e quem fica fora do ranking da equipe interna.
// Cadastradas pelos admins em Configurações › Cupons e vendedores; o painel carrega a lista ao abrir.
// codes: todos os cupons da pessoa, o primeiro é o principal; na lista de cupons eles contam como um só.
// sellerNames: como a pessoa aparece no campo "ID do canal de origem" do Pipedrive.
export interface CouponPerson {
  name: string;
  codes: string[];
  sellerNames: string[];
  outsideRanking: boolean;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const palavrasDe = (s: unknown) => semAcento(String(s ?? "")).split(/[^a-z0-9]+/).filter(Boolean);
export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

let PESSOAS: CouponPerson[] = [];

export function setCouponPeople(list: CouponPerson[]) {
  PESSOAS = list
    .map((p) => ({ ...p, codes: [...new Set(p.codes.map(normalizeCode).filter(Boolean))], sellerNames: p.sellerNames.map((n) => n.trim()).filter(Boolean) }))
    .filter((p) => p.codes.length > 0 || p.sellerNames.length > 0);
}

export function getCouponPeople(): CouponPerson[] {
  return PESSOAS;
}

function personOfCode(code: string) {
  // Os cupons cadastrados ficam sem espaços ("TIMECUPOLA"); a Sympla pode mandar "TIME CUPOLA".
  const alvo = normalizeCode(code);
  return PESSOAS.find((p) => p.codes.includes(alvo));
}

// Pessoa cadastrada a partir do vendedor do faturado no Pipedrive: todas as palavras de um dos nomes precisam aparecer.
export function personBySeller(seller: unknown): CouponPerson | null {
  const palavras = palavrasDe(seller);
  if (!palavras.length) return null;
  return PESSOAS.find((p) => p.sellerNames.some((n) => {
    const alvo = palavrasDe(n);
    return alvo.length > 0 && alvo.every((w) => palavras.includes(w));
  })) ?? null;
}

// Código principal da pessoa: LETICIA10 → LETICIAC5. Os outros cupons ficam como vieram.
export function canonicalCoupon(code: string): string {
  return personOfCode(code)?.codes[0] ?? code;
}

// Como mostrar o cupom na lista: pessoa cadastrada aparece pelo nome ("Leticia B"); os outros pelo código.
export function couponLabel(code: string): string {
  return personOfCode(code)?.name.trim() || code;
}

// Todos os códigos por trás de uma linha da lista ("LETICIAC5 + LETICIA10 + LETICIA15").
export function couponCodes(code: string): string {
  return personOfCode(code)?.codes.join(" + ") ?? code;
}

// Cupom de pessoa que segue no grupo, mas não pontua no ranking da equipe.
export function isOutsideRanking(code: string): boolean {
  return !!personOfCode(code)?.outsideRanking;
}

// Cupom principal de quem está fora do ranking, pelo vendedor do faturado no Pipedrive ("LETICIA BELLO" → LETICIAC5).
export function outsideTeamBySeller(seller: unknown): string | null {
  const p = personBySeller(seller);
  if (!p?.outsideRanking) return null;
  return p.codes[0] ?? p.name.toUpperCase();
}

export interface ParsedCoupon {
  code: string;
  // Desconto como a Sympla envia: "10.00%" ou "R$ 944.55".
  discount: string | null;
  kind: CouponKind;
  group: CouponGroup;
}

// A Sympla grava o cupom como "<desconto> - <código>", ex.: "10.00% - ISABELLESA10" ou "R$ 944.55 - IDEALIZZE".
export function parseCoupon(raw: string | null | undefined): ParsedCoupon | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const match = value.match(/^((?:R\$\s*)?[\d.,]+%?)\s+-\s+(.+)$/);
  const code = canonicalCoupon((match ? match[2] : value).trim().toUpperCase());
  const discount = match ? match[1].replace(/\s+/g, " ") : null;
  const pessoa = personOfCode(code);
  let kind: CouponKind = "desconto";
  if (code.startsWith(INVOICED_COUPON_PREFIX)) kind = "faturado";
  else if (discount && /^100(?:[.,]0+)?%$/.test(discount)) kind = "cortesia";

  const percent = discount?.endsWith("%") ? Number(discount.replace("%", "")) : null;
  let group: CouponGroup = "parceiro";
  if (kind === "faturado") group = "faturado";
  else if (/^GANHADOR|RESGATE/.test(code)) group = "resgate";
  else if (/PALESTR|SPEAKER/.test(code)) group = "palestrante";
  else if (pessoa || (TEAM_CODE.test(code) && (percent === null || percent === TEAM_DISCOUNT))) group = "equipe";
  return { code, discount, kind, group };
}

export function formatDiscount(discount: string | null): string {
  if (!discount) return "—";
  if (discount.endsWith("%")) return `${Number(discount.replace("%", "")).toLocaleString("pt-BR")}%`;
  const valor = Number(discount.replace(/[^\d.]/g, ""));
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Nome da pessoa a partir do cupom da equipe, só o primeiro nome: EMILLYN5 → Emillyn, ALINEB5 → Aline.
// A letra solta no fim (inicial do sobrenome) sai quando é uma consoante em que nome brasileiro não costuma terminar.
export function teamMemberName(code: string): string {
  // Pessoa cadastrada em Configurações: usa o nome cadastrado (ex.: "Aline B").
  const pessoa = personOfCode(code);
  if (pessoa?.name.trim()) return pessoa.name.trim();
  let base = code.replace(/\d+$/, "").toLowerCase();
  if (base.length > 4 && /[bcdfgjkpqtvwx]$/.test(base)) base = base.slice(0, -1);
  // Inicial do sobrenome igual à última letra do nome: LETICIAA5 → Leticia.
  else if (base.length > 4 && /([aeiou])\1$/.test(base)) base = base.slice(0, -1);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Desconto em R$ dado por um cupom parcial (menor que 100%). Cupons de 100% e faturados não entram (retorna 0).
// Percentual: preço cheio = valor pago ÷ (1 − desconto). Valor fixo: valor do cupom × quantidade.
export function couponDiscountValue(t: { coupon_code?: string | null; total_price?: number | string | null; quantity?: number | null }): number {
  const c = parseCoupon(t.coupon_code);
  if (!c || !c.discount || c.kind !== "desconto") return 0;
  const pago = Number(t.total_price || 0);
  if (c.discount.endsWith("%")) {
    const p = Number(c.discount.replace("%", "").replace(",", ".")) / 100;
    if (!(p > 0 && p < 1)) return 0;
    return Math.round(((pago / (1 - p)) * p) * 100) / 100;
  }
  const fixo = Number(c.discount.replace(/[^\d.]/g, ""));
  return Math.round(fixo * (t.quantity || 1) * 100) / 100;
}

// Separa um cupom da equipe em nome + letra diferenciadora + desconto, a partir do primeiro nome da pessoa.
// LETICIAA5 com "Leticia" → { letra: "A", desconto: 5 }; ALINEPAVEZI5 com "Aline" → letra null, resto "PAVEZI".
export function splitTeamCoupon(code: string, firstName: string): { letra: string | null; sufixo: string; desconto: number | null } | null {
  const base = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  const m = code.trim().toUpperCase().match(/^([A-Z]+)(\d+)?$/);
  if (!m || !base || !m[1].startsWith(base)) return null;
  const sufixo = m[1].slice(base.length);
  return { letra: sufixo.length === 1 ? sufixo : null, sufixo, desconto: m[2] ? Number(m[2]) : null };
}
