import { describe, expect, it } from "vitest";
import { coversWholeEvent, inPeriod, normalizeSoldAt, parseDay, ticketsInPeriod } from "@/lib/period";

const maio = { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31, 23, 59, 59) };

describe("datas de venda", () => {
  it("lê o horário de Brasília que o banco guardou como UTC", () => {
    expect(normalizeSoldAt("2026-11-04T08:36:41+00:00")).toBe("2026-11-04T11:36:41.000Z");
    expect(normalizeSoldAt("2026-11-04 08:36:41")).toBe("2026-11-04T11:36:41.000Z");
    expect(normalizeSoldAt(null)).toBeNull();
  });

  it("venda de madrugada fica no dia certo", () => {
    // 01:30 de 01/05 em Brasília: antes caía em 30/04 e saía de maio.
    expect(inPeriod(normalizeSoldAt("2026-05-01T01:30:00+00:00"), maio)).toBe(true);
    expect(inPeriod(normalizeSoldAt("2026-05-31T23:50:00+00:00"), maio)).toBe(true);
    expect(inPeriod(normalizeSoldAt("2026-06-01T00:10:00+00:00"), maio)).toBe(false);
  });

  it("data só com dia vale o dia inteiro no horário local", () => {
    expect(parseDay("2026-05-01").getDate()).toBe(1);
    expect(inPeriod("2026-05-01", maio)).toBe(true);
    expect(inPeriod("2026-04-30", maio)).toBe(false);
  });

  it("filtra vendas e cortesias de maio", () => {
    const vendas = [
      { sold_at: normalizeSoldAt("2026-05-22T17:46:00+00:00"), quantity: 1 },
      { sold_at: normalizeSoldAt("2026-06-18T17:25:00+00:00"), quantity: 1 },
      { sold_at: normalizeSoldAt("2026-11-03T09:06:00+00:00"), quantity: 2 },
    ];
    expect(ticketsInPeriod(vendas, maio)).toHaveLength(1);
  });

  it("sabe quando o período cobre o evento inteiro", () => {
    const vendas = [{ sold_at: "2026-05-22T20:46:00.000Z" }];
    const hoje = new Date(2026, 10, 5);
    expect(coversWholeEvent({ from: new Date(2020, 0, 1), to: hoje }, vendas, hoje)).toBe(true);
    expect(coversWholeEvent(maio, vendas, hoje)).toBe(false);
    expect(coversWholeEvent({ from: new Date(2026, 10, 1), to: new Date(2026, 10, 30) }, vendas, hoje)).toBe(false);
  });
});
