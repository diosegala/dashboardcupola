import { describe, expect, it } from "vitest";
import { escalaDoRitmo } from "./paceScale";

describe("escala proporcional do ritmo", () => {
  it("move a meta dentro da mesma escala de referência", () => {
    const a = escalaDoRitmo(1, 10, 20);
    const b = escalaDoRitmo(1, 15, 20);
    expect(a.maximo).toBe(24);
    expect(b.maximo).toBe(24);
    expect(a.marcador).toBeCloseTo(10 / 24);
    expect(b.marcador).toBeCloseTo(15 / 24);
  });
  it("realizado e meta compartilham a mesma unidade em qualquer visão", () => {
    for (const [valor, meta] of [[1, 10], [30, 120], [282, 2000]]) {
      const escala = escalaDoRitmo(valor, meta);
      expect(escala.realizado * escala.maximo).toBeCloseTo(valor);
      expect((escala.marcador ?? 0) * escala.maximo).toBeCloseTo(meta);
    }
  });
  it("não cria marcador sem meta e acomoda meta ultrapassada", () => {
    expect(escalaDoRitmo(0, null).marcador).toBeNull();
    const escala = escalaDoRitmo(40, 10);
    expect(escala.maximo).toBeGreaterThan(40);
    expect(escala.realizado).toBeGreaterThan(escala.marcador ?? 0);
  });
});