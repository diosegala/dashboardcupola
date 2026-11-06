import { describe, it, expect } from "vitest";
import { withBatchByDate, batchOf } from "./batches";

const sympla = [
  { ticket_type: "Pré-Venda 2027 | Ingresso Padrão (21 e 22/05)", sold_at: "2026-05-22T12:00:00Z" },
  { ticket_type: "Lote 0 | Ingresso Padrão", sold_at: "2026-11-03T12:00:00Z" },
];
const lote = (t: { ticket_type?: string | null }[]) => t.map((x) => batchOf(x.ticket_type));

describe("lotes", () => {
  it("ingresso Pré-Venda da Sympla fica na Pré-venda", () => {
    expect(lote(withBatchByDate(sympla))[0]).toBe("Pré-venda");
  });
  it("faturado vendido antes de novembro entra no Lote 0, não na Pré-venda", () => {
    const r = withBatchByDate([...sympla, { ticket_type: "Pré-venda | Faturado", sold_at: "2026-08-10T12:00:00Z", source: "pipedrive" }]);
    expect(batchOf(r[2].ticket_type)).toBe("Lote 0");
  });
});
