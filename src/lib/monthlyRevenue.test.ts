import { describe, expect, it } from "vitest";
import { mesBrasilia, monthlyRevenueGoals, sponsorMonthly, ticketMonthly, totalMonthly } from "./monthlyRevenue";

describe("ticketMonthly", () => {
  const sympla = [
    { sold_at: "2026-10-05T15:00:00Z", quantity: 2, total_price: 1000 },
    { sold_at: "2026-11-01T02:00:00Z", quantity: 1, total_price: 500 }, // 31/10 23h em Brasília
    { sold_at: "2026-11-08T12:00:00Z", quantity: 1, total_price: 800 },
  ];
  const faturados = [{ sold_at: "2026-11-09T12:00:00Z", quantity: 5, total_price: 4000 }];
  const meses = ticketMonthly({ sympla, faturados, fim: "2027-05", hoje: "2026-11" });

  it("agrupa pelo mês de Brasília e separa Sympla de faturados", () => {
    expect(mesBrasilia("2026-11-01T02:00:00Z")).toBe("2026-10");
    expect(meses[0]).toMatchObject({ mes: "2026-10", sympla: 1500, faturado: 0, ingressos: 3 });
    expect(meses[1]).toMatchObject({ mes: "2026-11", sympla: 800, faturado: 4000, ingressos: 6, parcial: true });
  });

  it("vai até o mês do evento e o acumulado bate com a soma", () => {
    expect(meses[meses.length - 1].mes).toBe("2027-05");
    expect(meses[meses.length - 1].acumulado).toBe(6300);
    expect(meses.reduce((s, m) => s + m.total, 0)).toBe(6300);
  });

  it("compara com o mesmo mês do ano anterior", () => {
    const m = ticketMonthly({ sympla, faturados: [], anterior: [{ sold_at: "2025-11-10T12:00:00Z", quantity: 1, total_price: 300 }], fim: "2026-11", hoje: "2026-11" });
    expect(m.find((x) => x.mes === "2026-11")?.anoAnterior).toBe(300);
  });
});

describe("sponsorMonthly", () => {
  it("soma por mês de fechamento, conta só cotas e marca sem valor", () => {
    const m = sponsorMonthly({
      vendas: [
        { ganhoEm: "2026-10-20", valor: 50000, quantidade: 1, cotaKey: "ouro", cota: "Ouro", adicional: false },
        { ganhoEm: "2026-10-21", valor: 0, quantidade: 1, cotaKey: "prata", cota: "Prata", adicional: false },
        { ganhoEm: "2026-11-02", valor: 3000, quantidade: 2, cotaKey: null, cota: null, adicional: true },
      ],
      fim: "2026-12",
      hoje: "2026-11",
    });
    expect(m[0]).toMatchObject({ mes: "2026-10", valor: 50000, cotas: 2, semValor: 1 });
    expect(m[1]).toMatchObject({ mes: "2026-11", valor: 3000, cotas: 0, parcial: true });
    expect(m[m.length - 1].acumulado).toBe(53000);
  });

  it("não perde venda ganha depois do mês final", () => {
    const m = sponsorMonthly({
      vendas: [{ ganhoEm: "2027-06-02", valor: 700, quantidade: 1, cotaKey: "ouro", cota: "Ouro", adicional: false }],
      inicio: "2027-04",
      fim: "2027-05",
      hoje: "2027-06",
    });
    expect(m.map((x) => x.mes)).toEqual(["2027-04", "2027-05", "2027-06"]);
    expect(m[m.length - 1].acumulado).toBe(700);
  });
});

describe("monthlyRevenueGoals", () => {
  it("aceita só metas de receita de um mês inteiro", () => {
    const g = monthlyRevenueGoals([
      { metric_key: "revenue", period_start: "2026-11-01", period_end: "2026-11-30", target_value: 100000 },
      { metric_key: "revenue", period_start: "2026-05-01", period_end: "2027-05-20", target_value: 9 },
      { metric_key: "revenue", ticket_type: "Lote 1", period_start: "2026-12-01", period_end: "2026-12-31", target_value: 5 },
    ]);
    expect(g).toEqual({ "2026-11": 100000 });
  });
});

describe("totalMonthly", () => {
  it("total é ingressos + patrocínios em cada mês", () => {
    const t = totalMonthly([{ mes: "2026-10", total: 100 }], [{ mes: "2026-10", valor: 50 }, { mes: "2026-11", valor: 10 }], "2026-11");
    expect(t).toMatchObject([{ mes: "2026-10", total: 150 }, { mes: "2026-11", total: 10, acumulado: 160 }]);
  });
});
