import { describe, expect, it } from "vitest";
import { precoDeTabelaDoLote, tipoDePreco, valorCheio, type LotePreco } from "./lotPricing";

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

import { resumoDesconto, descontoPonderado } from "./lotPricing";
describe("desconto médio", () => {
  it("pré-venda compara R$ 949 do comprador e não R$ 889,21 líquidos", () => {
    const r = resumoDesconto([{ produto: "Pré-Venda 2027 | Ingresso Padrão (21 e 22/05)", quantidade: 1, pago: 949, fonte: "sympla" }], lotes, 949);
    expect(r.total.pago).toBe(949);
    expect(descontoPonderado(r.total)).toBe(0);
  });
  it("visita avulsa paga entra no desconto com o preço de visita do lote", () => {
    const r = resumoDesconto([{ produto: "Lote 0 | Visita (dia 19)", quantidade: 1, pago: 2099, fonte: "sympla" }], lotes);
    expect(r.total.cheio).toBe(2099);
    expect(r.total.vendas).toBe(1);
  });
  it("cortesias e descontos de 100% não entram na base", () => {
    const r = resumoDesconto([{ produto: "Lote 0 | Padrão (dias 20 e 21)", quantidade: 1, pago: 0, fonte: "sympla" }], lotes);
    expect(r.total.cheio).toBe(0);
    expect(r.total.vendas).toBe(0);
  });
  it("Sympla sem cupom pelo valor do comprador dá 0% (R$ 989 = tabela)", () => {
    const r = resumoDesconto([{ produto: "Lote 0 | Padrão (dias 20 e 21)", quantidade: 1, pago: 989, fonte: "sympla" }], lotes);
    expect(descontoPonderado(r.total)).toBe(0);
  });
  it("faturado compara o valor fechado com a tabela do lote", () => {
    const r = resumoDesconto([{ produto: "Lote 1 | Ingresso Padrão", quantidade: 2, pago: 1996.2, fonte: "pipedrive" }], lotes);
    expect(descontoPonderado(r.faturado)).toBeCloseTo(0.1, 5);
    expect(r.sympla.vendas).toBe(0);
  });
  it("média ponderada pelo valor", () => {
    const r = resumoDesconto([
      { produto: "Lote 0 | Padrão (dias 20 e 21)", quantidade: 1, pago: 989, fonte: "sympla" },
      { produto: "Lote 0 | VIP (dias 20 e 21)", quantidade: 1, pago: 1044.5, fonte: "sympla" },
    ], lotes);
    expect(descontoPonderado(r.total)).toBeCloseTo(1044.5 / 3078, 5);
  });
  it("produto sem equivalência não entra no cálculo e vai para o aviso", () => {
    const r = resumoDesconto([{ produto: "Lote 1 | Ingresso Estudante", quantidade: 3, pago: 500, fonte: "sympla" }], lotes);
    expect(r.total.vendas).toBe(0);
    expect(r.semReferencia).toEqual([{ nome: "Lote 1 | Ingresso Estudante", quantidade: 3, motivo: "Produto sem equivalência na tabela de preços" }]);
  });
  it("lote sem preço cadastrado também vai para o aviso", () => {
    const r = resumoDesconto([{ produto: "Lote 5 | Padrão (dias 20 e 21)", quantidade: 1, pago: 1500, fonte: "sympla" }], lotes);
    expect(r.semReferencia[0].motivo).toContain("Lote 5");
  });
});
describe("nomes reais do Summit 27", () => {
  it("escritas com 'Ingresso' e a pré-venda com datas", () => {
    expect(valorCheio("Lote 0 | Ingresso VIP (dias 20 e 21)", lotes)).toBe(2089);
    expect(valorCheio("Lote 0 | Ingresso Padrão (dias 20 e 21)", lotes)).toBe(989);
    expect(valorCheio("Pré-Venda 2027 | Ingresso Padrão (21 e 22/05)", lotes, 949)).toBe(949);
  });
});

describe("preço de tabela do lote", () => {
  it("preço do lote vem do Padrão cadastrado; pré-venda do preço próprio", () => {
    expect(precoDeTabelaDoLote("Lote 1", [{ name: "Lote 1", price_standard: 1109 }], null)).toBe(1109);
    expect(precoDeTabelaDoLote("Lote 2", [{ name: "Lote 1", price_standard: 1109 }], null)).toBeNull();
    expect(precoDeTabelaDoLote("Pré-venda", [], 949)).toBe(949);
  });
});
