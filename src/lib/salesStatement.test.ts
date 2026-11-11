import { describe, expect, it } from "vitest";
import { agruparVendas } from "./salesStatement";

describe("extrato de vendas", () => {
  const sympla = (extra: object) => ({ source: "sympla", quantity: 1, status: "approved", sold_at: "2026-11-07T10:20:24Z", ...extra }) as never;
  const vendas = agruparVendas(
    [
      sympla({ order_id: "35EA3BUMQ1S", ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", total_price: 833.93, buyer_name: "Comprador A" }),
      sympla({ order_id: "35EA3BUMQ1S", ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", total_price: 833.93, buyer_name: "Comprador A" }),
      sympla({ order_id: "35EA3BTU1UD", ticket_type: "Lote 0 | Ingresso VIP (dias 20 e 21)", total_price: 1859.52, sold_at: "2026-11-03T17:36:00Z" }),
      { source: "pipedrive", quantity: 21, total_price: 16779, status: "approved", deal_id: "38040", crm_account: "cupola", company: "Pantera Imóveis", ticket_type: "Lote 0 | Grupo de Ingressos Padrão", sold_at: "2026-11-05T12:00:00Z" } as never,
    ],
    [],
  );

  it("uma linha por pedido ou negócio, com os ingressos somados", () => {
    expect(vendas.map((v) => [v.codigo, v.quantidade, v.ingressos, v.valor])).toEqual([
      ["35EA3BUMQ1S", 2, "2 Grupo", 1667.86],
      ["38040", 21, "21 Grupo", 16779],
      ["35EA3BTU1UD", 1, "1 VIP", 1859.52],
    ]);
  });

  it("faturado mostra a empresa e o link do negócio; Sympla, o comprador e o pedido", () => {
    expect(vendas[1]).toMatchObject({ faturado: true, cliente: "Pantera Imóveis", linkNegocio: "https://cupola.pipedrive.com/deal/38040", lote: "Lote 0" });
    expect(vendas[0]).toMatchObject({ faturado: false, cliente: "Comprador A", linkNegocio: null, tiposCompletos: ["10% OFF - 2 a 5 - Padrão"] });
  });
});

describe("etiqueta de status no extrato", () => {
  it("aprovada sem etiqueta; cancelada, estornada e pendente sinalizadas e fora dos totais", async () => {
    const { vendasDoExtrato, statusDaVenda } = await import("./salesStatement");
    expect([statusDaVenda("APPROVED"), statusDaVenda("CANCELLED"), statusDaVenda("R"), statusDaVenda("PENDING"), statusDaVenda("UNPAID")]).toEqual([null, "Cancelado", "Estornado", "Pendente", "Não pago"]);
    const paga = { source: "sympla", quantity: 1, status: "APPROVED", order_id: "OK", total_price: 900, ticket_type: "Lote 0 | Padrão", sold_at: "2026-11-05T12:00:00Z" } as never;
    const cancelada = { source: "sympla", quantity: 2, status: "CANCELLED", order_id: "35EA3BTT4Q7", total_price: 834, ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", sold_at: "2026-11-03T15:43:05Z" } as never;
    const pendente = { order_data: { id: "35EA3BUVAH5", order_status: "PENDING", order_date: "2026-11-08 22:46:03", order_total_net_value: 1853.38 } };
    const cancelarSemIngresso = { order_data: { id: "X", order_status: "CANCELLED" } };
    const v = vendasDoExtrato([paga], [paga, cancelada], [pendente, cancelarSemIngresso], []);
    expect(v.map((x) => [x.codigo, x.status])).toEqual([["35EA3BUVAH5", "Pendente"], ["OK", null], ["35EA3BTT4Q7", "Cancelado"]]);
  });
});
