import { describe, expect, it } from "vitest";
import { escalaDoRitmo, GAUGE, rotuloDoMarcador } from "./paceScale";

const foraDoArco = (x: number, y: number) =>
  Math.hypot(x - GAUGE.cx, y - GAUGE.cy) > GAUGE.r + GAUGE.stroke / 2;

const cantos = (r: { x: number; y: number; w: number; h: number }) => [
  [r.x - r.w / 2, r.y - r.h / 2],
  [r.x + r.w / 2, r.y - r.h / 2],
  [r.x - r.w / 2, r.y + r.h / 2],
  [r.x + r.w / 2, r.y + r.h / 2],
];

describe("rótulo do marcador de meta", () => {
  // A escala nunca deixa a meta passar de maximo/1,2, então o marcador fica entre 0 e 0,833.
  const fracs = [0, 0.1, 0.25, 0.5, 0.66, 0.833];
  const rotulos: [string, string][] = [
    ["Precisa", "14"],
    ["Precisa", "200"],
    ["Precisa", "2.000"],
    ["Precisa", "12.000"],
  ];

  it("nunca é cortado pelo viewBox", () => {
    for (const frac of fracs) {
      for (const [titulo, valor] of rotulos) {
        const r = rotuloDoMarcador(frac, titulo, valor);
        expect(r.x - r.w / 2, `esquerda em ${frac}/${valor}`).toBeGreaterThanOrEqual(GAUGE.vb.x);
        expect(r.x + r.w / 2, `direita em ${frac}/${valor}`).toBeLessThanOrEqual(GAUGE.vb.x + GAUGE.vb.w);
        expect(r.y - r.h / 2, `topo em ${frac}/${valor}`).toBeGreaterThanOrEqual(GAUGE.vb.y);
        expect(r.y + r.h / 2, `base em ${frac}/${valor}`).toBeLessThanOrEqual(GAUGE.vb.y + GAUGE.vb.h);
      }
    }
  });

  it("não encosta no arco do velocímetro", () => {
    for (const frac of fracs) {
      for (const [titulo, valor] of rotulos) {
        const r = rotuloDoMarcador(frac, titulo, valor);
        for (const [x, y] of cantos(r)) {
          expect(foraDoArco(x, y), `canto em ${frac}/${valor}`).toBe(true);
        }
      }
    }
  });

  it("sobe mais perto das pontas e fica no alto quando a meta está no meio", () => {
    const meio = rotuloDoMarcador(0.5, "Precisa", "2.000");
    const ponta = rotuloDoMarcador(0.833, "Precisa", "2.000");
    expect(ponta.x).toBeGreaterThan(meio.x);
    expect(ponta.y).toBeGreaterThan(meio.y);
    // No meio, o rótulo fica acima do arco; na ponta, à direita dele.
    expect(meio.y).toBeLessThan(GAUGE.cy - GAUGE.r);
    expect(ponta.x).toBeGreaterThan(GAUGE.cx + GAUGE.r);
  });
});

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