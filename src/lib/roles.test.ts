import { describe, expect, it } from "vitest";
import { realRole, NO_ROLE } from "./roles";

describe("realRole", () => {
  it("mostra a função gravada da pessoa", () => {
    expect(realRole(["seller"])).toBe("seller");
  });
  it("conta sem função gravada fica sem função, nunca vira Visualizador", () => {
    expect(realRole([])).toBe(NO_ROLE);
  });
  it("se houver mais de uma, vale a que dá mais acesso", () => {
    expect(realRole(["viewer", "admin"])).toBe("admin");
  });
});
