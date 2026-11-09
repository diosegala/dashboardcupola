import { describe, expect, it } from "vitest";
import { groupByPurchase } from "./emailAttribution";

describe("vendas do e-mail por compra", () => {
  it("junta os ingressos do mesmo pedido em uma linha, com quantidade e valor somados", () => {
    const v = (id: string, pedido: string, valor: number, soldAt: string) => ({ id, pedido, utmContent: "x", soldAt, quantidade: 1, valor });
    const r = groupByPurchase([v("a", "P1", 800, "2026-11-03T10:00:00Z"), v("b", "P1", 800, "2026-11-03T10:00:00Z"), v("c", "P2", 900, "2026-11-04T10:00:00Z")], (s) => s.pedido);
    expect(r.map((g) => [g.pedido, g.ingressos, g.valor])).toEqual([["P2", 1, 900], ["P1", 2, 1600]]);
  });
});
