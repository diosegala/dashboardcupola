import { describe, expect, it } from "vitest";
import { commercialDiscounts, fullPrices } from "./lotPrice";

const pago = (preco: number) => ({ quantity: 1, unit_price: preco, total_price: preco, ticket_type: "Lote 1 | VIP", coupon_code: null });

describe("preço cheio do lote", () => {
  it("usa o preço mais comum sem cupom", () => {
    const { byBatch } = fullPrices([pago(500), pago(500), pago(300)]);
    expect(byBatch.get("Lote 1")).toBe(500);
  });
});

describe("descontos concedidos (Comercial)", () => {
  it("cortesia entra pelo preço cheio do lote e o % é sobre a receita bruta", () => {
    const cortesia = { quantity: 2, unit_price: 0, total_price: 0, ticket_type: "Lote 1 | VIP", coupon_code: "100.00% - GANHADOR1" };
    const r = commercialDiscounts([cortesia], 1000, [pago(500), pago(500), cortesia]);
    expect(r.total).toBe(1000);
    expect(r.bruta).toBe(2000);
    expect(r.pct).toBe(0.5);
  });
});
