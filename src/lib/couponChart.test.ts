import { describe, expect, it } from "vitest";
import { montarPizza } from "./couponChart";

const cupom = (code: string, uses: number) => ({ code, uses });

describe("pizza de cupons em uso", () => {
  // Números da tela: 87 + 21 + 13 + 12 + 5 + 19 = 157 usos de cupom, mais 76 vendas sem cupom.
  const usados = [cupom("SUELLEN5", 87), cupom("LETICIAC5", 21), cupom("KEITY5", 13), cupom("KARINY5", 12), cupom("MAXIMIZA40", 5), cupom("IDEALIZZE", 19)];
  const semCupom = { usos: 76 };

  it("o centro soma só os usos de cupom e não soma o sem cupom", () => {
    const { fatias, usosEmCupons } = montarPizza(usados, semCupom, { todos: true, buscando: false });
    expect(usosEmCupons).toBe(157);
    // A pizza continua mostrando as 76 vendas sem cupom, mas elas não entram no total do centro.
    expect(fatias.find((f) => f.label === "Sem cupom")?.value).toBe(76);
    expect(fatias.reduce((s, f) => s + f.value, 0)).toBe(233);
  });

  it("mantém a fatia Sem cupom em Todos sem busca", () => {
    const { fatias } = montarPizza(usados, semCupom, { todos: true, buscando: false });
    expect(fatias.map((f) => f.label)).toEqual(["SUELLEN5", "LETICIAC5", "KEITY5", "KARINY5", "MAXIMIZA40", "Outros", "Sem cupom"]);
    expect(fatias.find((f) => f.label === "Outros")?.value).toBe(19);
  });

  it("não mostra Sem cupom quando um grupo está selecionado", () => {
    const { fatias, usosEmCupons } = montarPizza([cupom("SUELLEN5", 87)], semCupom, { todos: false, buscando: false });
    expect(fatias.map((f) => f.label)).toEqual(["SUELLEN5"]);
    expect(usosEmCupons).toBe(87);
  });

  it("não mostra Sem cupom durante uma busca", () => {
    const { fatias } = montarPizza(usados, semCupom, { todos: true, buscando: true });
    expect(fatias.some((f) => f.semCupom)).toBe(false);
  });

  it("não soma sem cupom quando não há venda sem cupom", () => {
    const { fatias, usosEmCupons } = montarPizza(usados, { usos: 0 }, { todos: true, buscando: false });
    expect(fatias.some((f) => f.semCupom)).toBe(false);
    expect(usosEmCupons).toBe(157);
  });
});
