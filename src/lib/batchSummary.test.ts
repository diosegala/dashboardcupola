import { describe, it, expect } from "vitest";
import { progressoLote } from "./batchSummary";

describe("progressoLote", () => {
  it("calcula % vendido e saldo com meta", () => {
    expect(progressoLote(75, 300)).toEqual({ pct: 0.25, saldo: 225 });
  });
  it("saldo não fica negativo quando passa da meta", () => {
    expect(progressoLote(320, 300).saldo).toBe(0);
  });
  it("sem meta não tem % nem saldo", () => {
    expect(progressoLote(50, null)).toEqual({ pct: null, saldo: null });
  });
});
