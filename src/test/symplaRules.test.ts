import { describe, expect, it } from "vitest";
import { invoiceCompany, pendingTickets } from "../../supabase/functions/_shared/sympla-rules";

// Preços dos participantes do CUPOLA Summit 2027 em 05/11/2026 (valor líquido de cada ingresso).
const P = (order_id: string, ticket_sale_price: number, ticket_name = "Lote 0 | Ingresso Padrão") => ({ order_id, ticket_sale_price, ticket_name });
const evento = [
  ...Array(18).fill(0).map(() => P("pre", 889.21, "Pré-Venda 2027")),
  P("BTQ7LA", 833.93), P("BTQ7LA", 833.93),
  P("BTQL6F", 926.69),
  P("BTRHT8", 833.93), P("BTRHT8", 833.93), P("BTRHT8", 833.93),
  P("BTTNRN", 880.36),
  P("BTU1UD", 1859.52, "Lote 0 | Ingresso VIP"),
  P("BU2DMT", 833.93), P("BU2DMT", 833.93),
];
const pedido = (id: string, net: number) => ({ id, order_status: "APPROVED", order_total_net_value: net });
const doPedido = (id: string) => evento.filter((p) => p.order_id === id);
const faltam = (id: string, net: number) => pendingTickets(pedido(id, net), doPedido(id), evento)?.quantity ?? 0;

describe("ingressos vendidos sem participante", () => {
  it("pedido completo não gera ingresso pendente", () => {
    expect(pendingTickets(pedido("BTRHT8", 2501.79), doPedido("BTRHT8"), evento)).toBeNull();
  });

  it("pedido sem nenhum participante conta todos os ingressos vendidos", () => {
    expect(faltam("BTTBES", 4169.65)).toBe(5);
    expect(faltam("BTTEU9", 1667.86)).toBe(2);
    expect(faltam("BU2055", 926.69)).toBe(1);
    expect(faltam("BTT0Y6", 1859.52)).toBe(1);
    expect(faltam("BU1195", 3961.15)).toBe(5); // 5 ingressos de 833,93 com cupom de 5%
    expect(faltam("BTVUH2", 6304.16)).toBe(8);
  });

  it("pedido parcialmente vinculado conta só os que faltam", () => {
    expect(faltam("BU2DMT", 2501.79)).toBe(1);
    expect(faltam("BTU1UD", 3719.04)).toBe(1);
  });

  it("vincular pessoas não muda o total do pedido", () => {
    const comprados = 5;
    for (let vinculados = 0; vinculados <= comprados; vinculados++) {
      const ps = Array(vinculados).fill(0).map(() => P("X", 833.93));
      const pend = pendingTickets(pedido("X", 4169.65), ps, evento);
      expect(vinculados + (pend?.quantity ?? 0)).toBe(comprados);
    }
  });

  it("pedido não aprovado não conta", () => {
    expect(pendingTickets({ ...pedido("C", 1667.86), order_status: "CANCELLED" }, [], evento)).toBeNull();
  });

  it("evento de hoje soma 53 ingressos e R$ 43.535,50, como na Sympla", () => {
    const pedidos = [
      pedido("BTQ7LA", 1667.86), pedido("BTQL6F", 926.69), pedido("BTRHT8", 2501.79), pedido("BTTNRN", 880.36),
      pedido("BTU1UD", 3719.04), pedido("BU2DMT", 2501.79), pedido("BU1195", 3961.15), pedido("BU2055", 926.69),
      pedido("BTT0Y6", 1859.52), pedido("BTTBES", 4169.65), pedido("BTTEU9", 1667.86), pedido("BTVUH2", 6304.16),
    ];
    const pend = pedidos.map((o) => pendingTickets(o, doPedido(o.id), evento)).filter(Boolean);
    // 29 participantes no painel hoje: 24 pagos (R$ 21.953,02) e 5 cortesias de R$ 0.
    const ingressos = 29 + pend.reduce((s, p) => s + p!.quantity, 0);
    const receita = 21953.02 + pend.reduce((s, p) => s + p!.total, 0);
    expect(ingressos).toBe(53);
    expect(Math.round(receita * 100) / 100).toBeCloseTo(43535.5, 0);
  });

  it("empresa só quando a nota sai em CNPJ", () => {
    expect(invoiceCompany({ invoice_info: { doc_type: "CNPJ", client_name: "Imobiliária X" } })).toBe("Imobiliária X");
    expect(invoiceCompany({ invoice_info: { doc_type: "CPF", client_name: "Fulana" } })).toBeNull();
  });
});
