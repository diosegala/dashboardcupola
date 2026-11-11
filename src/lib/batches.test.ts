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

describe("faturado na virada de lote", () => {
  it("usa a data de criação do negócio para o lote", () => {
    const cal = [
      { name: "Lote 0", start_date: "2026-11-03", end_date: "2026-11-08" },
      { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25" },
    ];
    const [t] = withBatchByDate([{ ticket_type: "Lote 1 | Ingresso VIP", sold_at: "2026-11-09T12:21:12Z", batch_at: "2026-11-06T19:45:13Z", source: "pipedrive" }], cal);
    expect(t.ticket_type).toBe("Lote 0 | Ingresso VIP");
  });
});

describe("ordem das listas de lotes", () => {
  it("vigente primeiro, anteriores do mais recente ao mais antigo, próximos em ordem", async () => {
    const { lotesParaLista } = await import("./batches");
    expect(lotesParaLista(["Pré-venda", "Lote 0", "Lote 1", "Lote 2", "Lote 3"], "Lote 1")).toEqual(["Lote 1", "Lote 0", "Pré-venda", "Lote 2", "Lote 3"]);
    expect(lotesParaLista(["Lote 0", "Pré-venda", "Lote 0"], null)).toEqual(["Lote 0", "Pré-venda"]);
  });
});
