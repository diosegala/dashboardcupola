import { INVOICED_COUPON_PREFIX } from "@/lib/eventConfig";

export type CouponKind = "faturado" | "cortesia" | "desconto";

export interface ParsedCoupon {
  code: string;
  // Desconto como a Sympla envia: "10.00%" ou "R$ 944.55".
  discount: string | null;
  kind: CouponKind;
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
  return { code, discount, kind };
}

export function formatDiscount(discount: string | null): string {
  if (!discount) return "—";
  if (discount.endsWith("%")) return `${Number(discount.replace("%", "")).toLocaleString("pt-BR")}%`;
  const valor = Number(discount.replace(/[^\d.]/g, ""));
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
