import { describe, expect, it } from "vitest";
import { commercialDiscounts } from "./lotPrice";

describe("descontos concedidos (Comercial)", () => {
  it("cupom de 100% não entra", () => {
    const resgate = { quantity: 2, unit_price: 0, total_price: 0, ticket_type: "Lote 1 | VIP", coupon_code: "100.00% - GANHADOR1" };
    expect(commercialDiscounts([resgate], 1000).total).toBe(0);
  });
  it("cupom parcial entra no total e o % é sobre a receita bruta", () => {
    const parcial = { quantity: 1, unit_price: 400, total_price: 400, ticket_type: "Lote 1 | VIP", coupon_code: "20.00% - PARCEIRO" };
    const r = commercialDiscounts([parcial], 400);
    expect(r.total).toBe(100);
    expect(r.pct).toBe(0.2);
  });
});
