import { describe, it, expect } from "vitest";
import { splitTeamCoupon } from "./coupons";

describe("splitTeamCoupon", () => {
  it("letra diferenciadora antes do desconto", () => {
    expect(splitTeamCoupon("LETICIAA5", "Letícia")).toEqual({ letra: "A", sufixo: "A", desconto: 5 });
    expect(splitTeamCoupon("LETICIAC5", "Leticia")).toEqual({ letra: "C", sufixo: "C", desconto: 5 });
  });
  it("desconto variável sem letra", () => {
    expect(splitTeamCoupon("LETICIA15", "Leticia")).toEqual({ letra: null, sufixo: "", desconto: 15 });
  });
  it("sobrenome inteiro não vira letra", () => {
    expect(splitTeamCoupon("ALINEPAVEZI5", "Aline")?.letra).toBeNull();
  });
  it("nome diferente não casa", () => {
    expect(splitTeamCoupon("ALICE5", "Aline")).toBeNull();
  });
});
