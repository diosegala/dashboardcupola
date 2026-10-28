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
  const code = (match ? match[2] : value).trim().toUpperCase();
  const discount = match ? match[1].replace(/\s+/g, " ") : null;
  let kind: CouponKind = "desconto";
  if (code.startsWith(INVOICED_COUPON_PREFIX)) kind = "faturado";
  else if (discount && /^100(?:[.,]0+)?%$/.test(discount)) kind = "cortesia";

  const percent = discount?.endsWith("%") ? Number(discount.replace("%", "")) : null;
  let group: CouponGroup = "parceiro";
  if (kind === "faturado") group = "faturado";
  else if (/^GANHADOR|RESGATE/.test(code)) group = "resgate";
  else if (/PALESTR|SPEAKER/.test(code)) group = "palestrante";
  else if (TEAM_CODE.test(code) && (percent === null || percent === TEAM_DISCOUNT)) group = "equipe";
  return { code, discount, kind, group };
}

export function formatDiscount(discount: string | null): string {
  if (!discount) return "—";
  if (discount.endsWith("%")) return `${Number(discount.replace("%", "")).toLocaleString("pt-BR")}%`;
  const valor = Number(discount.replace(/[^\d.]/g, ""));
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Nome da pessoa a partir do cupom da equipe: EMILLYN5 → Emillyn.
export function teamMemberName(code: string): string {
  const base = code.replace(/\d+$/, "").toLowerCase();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
