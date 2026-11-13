import { describe, it, expect } from "vitest";
import { matchCouponPerson, uniqueCodes } from "./couponLink";

const people = [
  { id: "aline-b", name: "Aline B" },
  { id: "aline-p", name: "Aline P" },
  { id: "aline-pavezi", name: "Aline Pavezi" },
  { id: "suellen", name: "Suellen", sellerNames: ["Suellen Moreira"] },
  { id: "kassia", name: "Kássia" },
  { id: "erica", name: "Erica", email: "erica.x@cupola.com.br" },
];

describe("vínculo automático de cupons", () => {
  it("liga pelo e-mail primeiro", () => {
    expect(matchCouponPerson({ name: "Outro Nome", email: "Erica.X@cupola.com.br" }, people)).toBe("erica");
  });
  it("liga pelo nome completo ou nome de quem vende", () => {
    expect(matchCouponPerson({ name: "Aline Pavezi" }, people)).toBe("aline-pavezi");
    expect(matchCouponPerson({ name: "Suellen Moreira" }, people)).toBe("suellen");
  });
  it("liga pelo primeiro nome sem acento", () => {
    expect(matchCouponPerson({ name: "Kassia Calonassi" }, people)).toBe("kassia");
  });
  it("liga pelo primeiro nome + inicial do sobrenome", () => {
    expect(matchCouponPerson({ name: "Aline Borges" }, people)).toBe("aline-b");
  });
  it("não adivinha quando há mais de uma pessoa possível", () => {
    expect(matchCouponPerson({ name: "Aline" }, [...people, { id: "aline", name: "Aline" }, { id: "aline2", name: "aline" }])).toBeNull();
  });
  it("ligação manual vale mais que a automática", () => {
    const lista = people.map((p) => (p.id === "kassia" ? { ...p, linkManual: true } : p));
    expect(matchCouponPerson({ name: "Kassia Calonassi" }, lista)).toBeNull();
    expect(matchCouponPerson({ name: "Kassia Calonassi" }, people.map((p) => (p.id === "kassia" ? { ...p, userId: "outra" } : p)))).toBeNull();
  });
  it("agrupa o mesmo cupom sem repetir", () => {
    expect(uniqueCodes(["SUELLEN5", "suellen5", "SUELLEN10"])).toEqual(["SUELLEN5", "SUELLEN10"]);
  });
});
