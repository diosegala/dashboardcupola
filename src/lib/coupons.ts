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

// Contatos com cupom no formato da equipe que, por regra, não entram no ranking da equipe interna.
// codes: todos os cupons da pessoa, o primeiro é o principal; na lista de cupons eles contam como um só.
// names: palavras que identificam a pessoa no campo "ID do canal de origem" do Pipedrive (sem acento, minúsculas).
// Letícia Bello (Leticia Caetana Bello Pinguelli). LETICIAA5 é outra pessoa (Letícia Ardigó) e segue normal no ranking.
export const OUTSIDE_TEAM_RANKING: { codes: string[]; names: string[][] }[] = [
  { codes: ["LETICIAC5", "LETICIA10"], names: [["leticia", "bello"], ["leticia", "pinguelli"], ["leticia", "caetana"]] },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function outsideEntry(code: string) {
  return OUTSIDE_TEAM_RANKING.find((p) => p.codes.includes(code));
}

// Código principal da pessoa: LETICIA10 → LETICIAC5. Os outros cupons ficam como vieram.
export function canonicalCoupon(code: string): string {
  return outsideEntry(code)?.codes[0] ?? code;
}

// Como mostrar o cupom na lista: os códigos da mesma pessoa juntos ("LETICIAC5 + LETICIA10").
export function couponLabel(code: string): string {
  return outsideEntry(code)?.codes.join(" + ") ?? code;
}

// Cupom principal de quem está fora do ranking, pelo vendedor do faturado no Pipedrive ("LETICIA BELLO" → LETICIAC5).
export function outsideTeamBySeller(seller: unknown): string | null {
  const palavras = semAcento(String(seller ?? "")).split(/[^a-z0-9]+/).filter(Boolean);
  if (!palavras.length) return null;
  const p = OUTSIDE_TEAM_RANKING.find((x) => x.names.some((n) => n.every((w) => palavras.includes(w))));
  return p?.codes[0] ?? null;
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
  let kind: CouponKind = "desconto";
  if (code.startsWith(INVOICED_COUPON_PREFIX)) kind = "faturado";
  else if (discount && /^100(?:[.,]0+)?%$/.test(discount)) kind = "cortesia";

  const percent = discount?.endsWith("%") ? Number(discount.replace("%", "")) : null;
  let group: CouponGroup = "parceiro";
  if (kind === "faturado") group = "faturado";
  else if (/^GANHADOR|RESGATE/.test(code)) group = "resgate";
  else if (/PALESTR|SPEAKER/.test(code)) group = "palestrante";
  else if (outsideEntry(code)) group = "parceiro";
  else if (TEAM_CODE.test(code) && (percent === null || percent === TEAM_DISCOUNT)) group = "equipe";
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
  let base = code.replace(/\d+$/, "").toLowerCase();
  if (base.length > 4 && /[bcdfgjkpqtvwx]$/.test(base)) base = base.slice(0, -1);
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
