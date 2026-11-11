import { describe, expect, it } from "vitest";
import { pendingPayments } from "./pendingPayments";

describe("vendas aguardando pagamento", () => {
  // Pedidos do diagnóstico de 10/11/2026.
  const agora = new Date("2026-11-10T18:00:00-03:00").getTime();
  const rows = [
    { order_data: { id: "35EA3BUMQ1S", order_status: "PENDING", order_date: "2026-11-07 10:20:24", order_total_sale_price: 1780 } },
    { order_data: { id: "35EA3BUVAH5", order_status: "PENDING", order_date: "2026-11-08 22:46:03", order_total_sale_price: 1978 } },
    { order_data: { id: "35EA3BUMQ1S", order_status: "PENDING", order_date: "2026-11-07 10:20:24" } }, // repetido
    { order_data: { id: "35EA3BTT4Q7", order_status: "CANCELLED", order_date: "2026-11-03 15:43:05" } },
    { order_data: { id: "35EA3AV75DZ", order_status: "UNPAID", order_date: "2026-05-27 16:41:55" } },
    { order_data: { id: "35EA3BUZNT2", order_status: "APPROVED" } },
    { order_data: null },
  ];

  it("só pendentes, sem repetir, do mais antigo para o mais novo", () => {
    const r = pendingPayments(rows, agora);
    expect(r.pedidos.map((p) => [p.id, p.dias])).toEqual([["35EA3BUMQ1S", 3], ["35EA3BUVAH5", 1]]);
    expect(r.valor).toBe(3758);
  });

  it("pendente há mais de 3 dias vai para conferência na Sympla", () => {
    const depois = new Date("2026-11-11T12:00:00-03:00").getTime();
    expect(pendingPayments(rows, depois).paraConferir.map((p) => p.id)).toEqual(["35EA3BUMQ1S"]);
    expect(pendingPayments(rows, agora).paraConferir).toEqual([]);
  });
});
