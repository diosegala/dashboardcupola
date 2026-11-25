import { describe, expect, it } from "vitest";
import { comparativoLotes } from "./batchPace";

const lotes = [
  { lote: "Lote 1", inicio: "2026-11-09", fim: "2026-11-25" },
  { lote: "Lote 0", inicio: "2026-10-01", fim: "2026-11-08" },
];
const venda = (lote: string, dia: string, q = 1) => ({ lote, sold_at: `${dia}T15:00:00Z`, quantity: q });

describe("comparativo entre lotes", () => {
  it("divide os vendidos de cada lote pelos dias úteis em que esteve à venda; o vigente conta até hoje", () => {
    const r = comparativoLotes(lotes, [venda("Lote 1", "2026-11-10", 10), venda("Lote 0", "2026-10-05", 20)], "2026-11-13");
    const l1 = r.find((l) => l.lote === "Lote 1")!;
    expect(l1.vendidos).toBe(10);
    expect(l1.diasUteis).toBe(5);
    expect(l1.media).toBe(2);
    expect(l1.emAndamento).toBe(true);
    expect(r.find((l) => l.lote === "Lote 0")!.emAndamento).toBe(false);
  });
  it("o período do topo recorta vendas e dias; lote fora do período some", () => {
    const r = comparativoLotes(lotes, [venda("Lote 1", "2026-11-10", 10), venda("Lote 1", "2026-11-20", 5)], "2026-11-25", { inicio: "2026-11-16", fim: "2026-11-25" });
    expect(r.map((l) => l.lote)).toEqual(["Lote 1"]);
    expect(r[0].vendidos).toBe(5);
  });
});
