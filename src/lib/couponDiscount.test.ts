import { describe, expect, it } from "vitest";
import { couponDiscountValue } from "./coupons";

describe("couponDiscountValue", () => {
  it("10% sobre R$ 900 pagos dá R$ 100", () => expect(couponDiscountValue({ coupon_code: "10.00% - ISABELLESA10", total_price: 900, quantity: 1 })).toBe(100));
  it("valor fixo R$ 944.55 por 2 ingressos dá R$ 1.889,10", () => expect(couponDiscountValue({ coupon_code: "R$ 944.55 - IDEALIZZE", total_price: 0, quantity: 2 })).toBe(1889.1));
  it("cupom de 100% não entra", () => expect(couponDiscountValue({ coupon_code: "100.00% - GANHADOR_X", total_price: 0, quantity: 1 })).toBe(0));
});
