import { describe, expect, it } from "vitest";
import { salesByCategory, salesCategory } from "./salesCategories";

describe("salesCategory", () => {
  it("classifica pelos nomes usados na Sympla e nos faturados", () => {
    expect(salesCategory("Ingressos Individuais | Lote 0 | Padrão")).toBe("Padrão");
    expect(salesCategory("Ingressos em Grupo | Lote 0 | 10% OFF - 2 a 5 - Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | Grupo de Ingressos Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | 10% OFF - 2 a 5 - Padrão")).toBe("Grupo");
    expect(salesCategory("Lote 0 | Padrão (dias 20 e 21)")).toBe("Padrão");
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
    expect(linhas.find((l) => l.categoria === "VIP")).toMatchObject({ categoria: "VIP", ingressos: 5, pedidos: 2, valor: 500, media: 100 });
    expect(linhas.find((l) => l.categoria === "Combo")?.media).toBeNull();
  });
});

describe("divisão Padrão/VIP e visita avulsa", () => {
  it("separa combos e grupos por nível e marca visita no mesmo pedido", () => {
    const linhas = salesByCategory([
      { quantity: 1, total_price: 2000, ticket_type: "Lote 7 | Combo VIP - Visita", sympla_order_id: "A" },
      { quantity: 2, total_price: 1500, ticket_type: "Lote 8 | Combo Padrão - Visita", sympla_order_id: "B" },
      { quantity: 3, total_price: 2400, ticket_type: "Lote 0 | 10% OFF - 2 a 5 Ingressos Padrão", sympla_order_id: "C" },
      { quantity: 1, total_price: 900, ticket_type: "Ingresso Summit (dias 20 e 21)", sympla_order_id: "D" },
      { quantity: 1, total_price: 100, ticket_type: "Lote 7 | Visita Presencial (20/05)", sympla_order_id: "D" },
      { quantity: 1, total_price: 100, ticket_type: "Lote 7 | Visita Presencial (20/05)", sympla_order_id: "E" },
    ]);
    const combo = linhas.find((l) => l.categoria === "Combo")!;
    expect(combo.porNivel.vip.ingressos).toBe(1);
    expect(combo.porNivel.padrao.ingressos).toBe(2);
    expect(linhas.find((l) => l.categoria === "Grupo")!.porNivel.padrao.ingressos).toBe(3);
    expect(linhas.find((l) => l.categoria === "Padrão")!.ingressos).toBe(1);
    const visita = linhas.find((l) => l.categoria === "Visita avulsa")!;
    expect(visita.ingressos).toBe(2);
    expect(visita.juntoComEvento).toBe(1);
  });
});
