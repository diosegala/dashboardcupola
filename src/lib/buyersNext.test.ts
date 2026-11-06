import { describe, it, expect } from "vitest";
import { titleCase, matchNextEvent } from "./buyers";

describe("titleCase", () => {
  it("padroniza maiúsculas", () => expect(titleCase("QUATRO VENTOS ADM")).toBe("Quatro Ventos Adm"));
  it("mantém preposições", () => expect(titleCase("andre amaro DE oliveira")).toBe("Andre Amaro de Oliveira"));
});

describe("matchNextEvent", () => {
  const compras = [{ name: "Ana Luíza Puhl", coupon: "KARINY5" }, { name: "Carlos Souza", coupon: null }];
  it("casa nome igual sem acento", () => expect(matchNextEvent("ANA LUIZA PUHL", compras)).toEqual({ comprou: true, coupon: "KARINY5" }));
  it("casa nome 90% igual", () => expect(matchNextEvent("Carlos Sousa", compras).comprou).toBe(true));
  it("não casa nome diferente", () => expect(matchNextEvent("Carla Mendes", compras).comprou).toBe(false));
});
