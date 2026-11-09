import { describe, expect, it } from "vitest";
import { salesByCategory, salesCategory } from "./salesCategories";

describe("salesCategory", () => {
  it("classifica pelos nomes usados na Sympla e nos faturados", () => {
    expect(salesCategory("Ingressos Individuais | Lote 0 | Padrão")).toBe("Individual");
    expect(salesCategory("Ingressos em Grupo | Lote 0 | 10% OFF - 2 a 5 - Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | Grupo de Ingressos Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | 10% OFF - 2 a 5 - Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | Padrão (dias 20 e 21)")).toBe("Individual");
    expect(salesCategory("Ingressos Individuais | Lote 0 | VIP")).toBe("VIP");
    expect(salesCategory("Ingressos Individuais | Lote 0 | Padrão + Visita")).toBe("Combo");
  });
});

describe("salesByCategory", () => {
  it("soma ingressos e valor e conta cada pedido ou negócio uma vez", () => {
    const linhas = salesByCategory([
      { quantity: 1, total_price: 100, ticket_type: "VIP", sympla_order_id: "A" },
      { quantity: 1, total_price: 100, ticket_type: "VIP", sympla_order_id: "A" },
      { quantity: 3, total_price: 300, ticket_type: "VIP", deal_id: "9" },
    ]);
    expect(linhas.find((l) => l.categoria === "VIP")).toEqual({ categoria: "VIP", ingressos: 5, pedidos: 2, valor: 500, media: 100 });
    expect(linhas.find((l) => l.categoria === "Combo")?.media).toBeNull();
  });
});
