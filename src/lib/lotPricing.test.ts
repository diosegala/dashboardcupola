import { describe, expect, it } from "vitest";
import { tipoDePreco, valorCheio, type LotePreco } from "./lotPricing";

const lotes: LotePreco[] = [
  { name: "Lote 0", price_standard: 989, price_vip: 2089, price_visit: 2099, price_standard_visit: 2988, price_vip_visit: 4088, price_group_standard: 890, price_group_vip: 1880 },
  { name: "Lote 1", price_standard: 1109, price_vip: 2219, price_visit: 2199, price_standard_visit: 3208, price_vip_visit: 4318, price_group_standard: 998, price_group_vip: 1997 },
];

describe("lotPricing", () => {
  it("produto base usa o valor do tipo no lote", () => {
    expect(valorCheio("Lote 1 | Padrão (dias 20 e 21)", lotes)).toBe(1109);
    expect(valorCheio("Lote 0 | VIP (dias 20 e 21)", lotes)).toBe(2089);
    expect(valorCheio("Lote 1 | Visita (dia 19)", lotes)).toBe(2199);
    expect(valorCheio("Lote 1 | VIP + Visita (dias 19, 20 e 21)", lotes)).toBe(4318);
  });
  it("Padrão + Visita e Combo Padrão são o mesmo produto", () => {
    expect(valorCheio("Lote 0 | Padrão + Visita (dias 19, 20 e 21)", lotes)).toBe(2988);
    expect(valorCheio("Lote 0 | Combo Padrão (dias 19, 20 e 21)", lotes)).toBe(2988);
  });
  it("grupo usa o valor padrão/VIP do lote como valor cheio, nas duas escritas", () => {
    expect(tipoDePreco("Lote 0 | 10% OFF - 2 a 5 - Padrão")?.campo).toBe("price_group_standard");
    expect(tipoDePreco("Lote 0 | 10% OFF - 2 a 5 Ingressos Padrão")?.campo).toBe("price_group_standard");
    expect(valorCheio("Lote 0 | 15% OFF - 6 a 10 Ingressos Padrão", lotes)).toBe(989);
    expect(valorCheio("Lote 1 | 10% OFF - a partir de 3 - VIP", lotes)).toBe(2219);
  });
  it("pré-venda usa R$ 949 fora dos lotes", () => {
    expect(valorCheio("Pré-Venda 2027 | Ingresso Padrão", lotes, 949)).toBe(949);
  });
  it("produto sem equivalência fica fora", () => {
    expect(valorCheio("Lote 1 | Ingresso padrão (21 e 22/05)", lotes)).toBeNull();
    expect(valorCheio("Expositor", lotes)).toBeNull();
    expect(valorCheio("Lote 9 | Padrão (dias 20 e 21)", lotes)).toBeNull();
  });
});
