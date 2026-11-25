import { describe, it, expect } from "vitest";
import { ritmoNoPeriodo, lotesDoRitmo, ritmoNecessario } from "./batchPace";

// Lote 1: 09/11/2026 (seg) a 20/11/2026 (sex) = 10 dias úteis (20/11 é feriado nacional → 9).
const vendas = [
  { sold_at: "2026-11-05T15:00:00Z", quantity: 4 }, // Lote 0: fica de fora
  { sold_at: "2026-11-10T15:00:00Z", quantity: 3 },
  { sold_at: "2026-11-12T15:00:00Z", quantity: 3 },
];

describe("ritmo por lote", () => {
  it("só conta as vendas do lote e divide pelos dias úteis já passados no Até hoje", () => {
    const r = ritmoNoPeriodo(vendas, "2026-11-09", "2026-11-20", "2026-11-13", "ate_hoje");
    expect(r.pagantes).toBe(6);
    expect(r.dias).toBe(5);
    expect(r.ritmo).toBe(1.2);
  });
  it("Total divide por todos os dias úteis do lote", () => {
    const r = ritmoNoPeriodo(vendas, "2026-11-09", "2026-11-20", "2026-11-13", "total");
    expect(r.dias).toBe(9);
    expect(r.ritmo).toBeCloseTo(6 / 9);
  });
  it("lote encerrado dá o mesmo valor nas duas visões", () => {
    const a = ritmoNoPeriodo(vendas, "2026-11-09", "2026-11-20", "2026-12-01", "ate_hoje");
    const b = ritmoNoPeriodo(vendas, "2026-11-09", "2026-11-20", "2026-12-01", "total");
    expect(a.ritmo).toBe(b.ritmo);
  });
  it("lote que não começou não tem número", () => {
    expect(ritmoNoPeriodo(vendas, "2026-12-01", "2026-12-10", "2026-11-13", "ate_hoje").ritmo).toBeNull();
  });
  it("necessário do lote = faltam ÷ dias úteis restantes", () => {
    expect(ritmoNecessario(30, 6, 4)).toEqual({ necessario: 6, faltam: 24 });
  });
  it("não repete a mesma faixa de datas e esconde lotes futuros", () => {
    const l = lotesDoRitmo([
      { name: "Pré-venda", start_date: "2026-11-03", end_date: "2026-11-08" },
      { name: "Lote 0", start_date: "2026-11-03", end_date: "2026-11-08" },
      { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25" },
      { name: "Lote 2", start_date: "2026-11-26", end_date: "2026-12-17" },
    ], "2026-11-25");
    expect(l.map((x) => x.name)).toEqual(["Pré-venda", "Lote 1"]);
  });
  it("ordem cronológica e períodos sobrepostos aparecem uma vez só", () => {
    const l = lotesDoRitmo([
      { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25", sort_order: 2 },
      { name: "Pré-venda", start_date: "2026-05-01", end_date: "2026-06-30", sort_order: 0 },
      { name: "Lote 0", start_date: "2026-06-15", end_date: "2026-11-08", sort_order: 1 },
    ], "2026-11-25");
    expect(l.map((x) => x.name)).toEqual(["Pré-venda", "Lote 1"]);
  });
  it("Evento todo conta todas as vendas pagas, mesmo fora de qualquer lote", () => {
    const r = ritmoNoPeriodo([...vendas, { sold_at: "2026-05-22T15:00:00Z", quantity: 18 }], "2026-11-09", "2026-11-20", "2026-11-13", "ate_hoje", true);
    expect(r.pagantes).toBe(28);
  });
});

import { marcoInicial, pagantesForaDeLote, loteAnterior, somarDias } from "./batchPace";

describe("ritmo do evento todo e vendas fora de lote", () => {
  const lotes = [
    { name: "Lote 0", start_date: "2026-11-03", end_date: "2026-11-08", sort_order: 0 },
    { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25", sort_order: 1 },
  ] as any;
  const vs = [
    { sold_at: "2026-05-22T20:46:00Z", quantity: 14 },
    { sold_at: "2026-10-30T15:00:00Z", quantity: 50 },
    { sold_at: "2026-11-10T15:00:00Z", quantity: 3 },
  ];
  it("o marco é a venda paga mais antiga e acompanha uma venda anterior que entrar", () => {
    expect(marcoInicial(vs)).toBe("2026-05-22");
    expect(marcoInicial([...vs, { sold_at: "2026-04-01T15:00:00Z", quantity: 1 }])).toBe("2026-04-01");
  });
  it("conta os pagantes fora de lote cadastrado (14 da pré-venda + 50 faturados = 64)", () => {
    expect(pagantesForaDeLote(vs, lotes)).toBe(64);
    expect(pagantesForaDeLote(vs, lotes, "2026-10-01", "2026-11-25")).toBe(50);
  });
  it("o primeiro lote não tem lote anterior", () => {
    expect(loteAnterior(lotes, "Lote 0")).toBeNull();
    expect(loteAnterior(lotes, "Lote 1")?.name).toBe("Lote 0");
  });
  it("últimos 7 dias corridos começam 6 dias antes de hoje", () => {
    expect(somarDias("2026-11-25", -6)).toBe("2026-11-19");
  });
});

import { nivelDoRitmo } from "./batchPace";
describe("nivelDoRitmo", () => {
  it("classifica pela cobertura do necessário", () => {
    expect(nivelDoRitmo(15, 15, 10)).toBe("ok");
    expect(nivelDoRitmo(12, 15, 10)).toBe("atencao");
    expect(nivelDoRitmo(8, 15, 10)).toBe("risco");
    expect(nivelDoRitmo(1.9, 15, 10)).toBe("critico");
    expect(nivelDoRitmo(0, 15, 0)).toBe("meta");
    expect(nivelDoRitmo(1, null, 10)).toBeNull();
  });
});

import { ritmoNoPeriodo as _rp, ritmoNecessario as _rn } from "./batchPace";
describe("ritmo necessário do lote", () => {
  it("faturado dentro das datas do lote reduz o que falta", () => {
    const vendas = [
      { sold_at: "2026-11-10T15:00:00Z", quantity: 44, ticket_type: "Lote 1 | Padrão" },
      { sold_at: "2026-11-12T15:00:00Z", quantity: 31, ticket_type: "Ingressos Summit", source: "pipedrive" },
    ] as any[];
    const r = _rp(vendas, "2026-11-09", "2026-11-25", "2026-11-25", "ate_hoje");
    expect(r.pagantes).toBe(75);
    expect(_rn(165, r.pagantes, r.diasRestantes).faltam).toBe(90);
  });
});
