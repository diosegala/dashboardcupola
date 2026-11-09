import { describe, expect, it } from "vitest";
import { loteNaData, loteVigente, situacao } from "@/lib/batchCalendar";
import { resumoLotes } from "@/lib/batchSummary";

const LOTES = [
  { name: "Lote 0", start_date: "2026-11-03", end_date: "2026-11-08", sort_order: 0 },
  { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25", sort_order: 1 },
  { name: "Lote 2", start_date: "2026-11-27", end_date: "2026-12-17", sort_order: 2 },
];

describe("lote vigente pelas datas", () => {
  it("09/11/2026 → Lote 1; 08/11 → Lote 0", () => {
    expect(loteVigente(LOTES, "2026-11-09").lote).toBe("Lote 1");
    expect(loteVigente(LOTES, "2026-11-08").lote).toBe("Lote 0");
  });
  it("venda às 02:59 UTC de 09/11 ainda é 08/11 em Brasília (Lote 0); às 03:00 vira Lote 1", () => {
    expect(loteNaData("2026-11-09T02:59:00Z", LOTES)).toBe("Lote 0");
    expect(loteNaData("2026-11-09T03:00:00Z", LOTES)).toBe("Lote 1");
  });
  it("data entre lotes → próximo lote", () => expect(loteVigente(LOTES, "2026-11-26").lote).toBe("Lote 2"));
  it("lote sem data → aviso, sem escolher", () => {
    expect(loteVigente([...LOTES, { name: "Lote 3", start_date: null, end_date: null }], "2026-11-10")).toEqual({ lote: null, faltamDatas: true });
  });
  it("lote futuro → não iniciado; passado → encerrado", () => {
    expect(situacao(LOTES[2], "2026-11-10")).toBe("nao_iniciado");
    expect(situacao(LOTES[0], "2026-11-10")).toBe("encerrado");
  });
  it("lote esgotado continua vigente até o término e lote sem venda aparece", () => {
    const goals = [{ metric_key: "tickets_sold", ticket_type: "Lote 1", target_value: 1 }];
    const tickets: any[] = [{ ticket_type: "Lote 1 | Padrão", quantity: 2, total_price: 200, unit_price: 100, status: "approved", sold_at: "2026-11-09T12:00:00Z", source: "sympla" }];
    const r = resumoLotes(goals, tickets, [], LOTES, "2026-11-20");
    expect(r.loteAtual).toBe("Lote 1");
    expect(r.lotes.find((l) => l.lote === "Lote 1")?.esgotado).toBe(true);
    expect(r.lotes.find((l) => l.lote === "Lote 2")?.situacao).toBe("nao_iniciado");
  });
});
