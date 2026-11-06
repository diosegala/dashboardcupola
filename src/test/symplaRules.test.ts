import { describe, expect, it } from "vitest";
import { incompleteOrders, invoiceCompany, participantsToCancel } from "../../supabase/functions/_shared/sympla-rules";

// A sincronização da Sympla só grava participantes reais: não há estimativa de ingressos sem participante.
describe("regras da Sympla", () => {
  it("empresa só quando a nota sai em CNPJ", () => {
    expect(invoiceCompany({ invoice_info: { doc_type: "CNPJ", client_name: "Imobiliária X" } })).toBe("Imobiliária X");
    expect(invoiceCompany({ invoice_info: { doc_type: "CPF", client_name: "Fulana" } })).toBeNull();
  });

  // Casos de 06/11/2026: a lista geral devolvia 1 de 2 ingressos de um pedido e nenhum de outro.
  it("pedido aprovado é conferido quando os participantes não fecham o valor", () => {
    const pedidos = [
      { id: "COMPLETO", order_status: "APPROVED", order_total_net_value: 1667.86 },
      { id: "PARCIAL", order_status: "APPROVED", order_total_net_value: 3719.04 },
      { id: "SEM", order_status: "APPROVED", order_total_net_value: 6304.16 },
      { id: "CORTESIA", order_status: "APPROVED", order_total_net_value: 0 },
      { id: "CORTESIA_SEM", order_status: "APPROVED", order_total_net_value: 0 },
      { id: "PENDENTE", order_status: "P", order_total_net_value: 926.69 },
    ];
    const participantes = [
      { order_id: "COMPLETO", ticket_sale_price: 833.93 },
      { order_id: "COMPLETO", ticket_sale_price: 833.93 },
      { order_id: "PARCIAL", ticket_sale_price: 1859.52 },
      { order_id: "CORTESIA", ticket_sale_price: 0 },
    ];
    expect(incompleteOrders(pedidos, participantes).map((o) => o.id)).toEqual(["PARCIAL", "SEM", "CORTESIA_SEM"]);
  });

  it("só cancela quem saiu da Sympla e não tem mais o pedido aprovado", () => {
    const gravados = [
      { sympla_order_id: "1", order_id: "A" }, // voltou na lista
      { sympla_order_id: "2", order_id: "A" }, // sumiu da lista, pedido segue aprovado: continua contando
      { sympla_order_id: "3", order_id: "B" }, // sumiu e o pedido saiu dos aprovados: cancelado
    ];
    expect(participantsToCancel(gravados, new Set(["1"]), new Set(["A"]))).toEqual(["3"]);
    // Sem a lista de pedidos não há como saber: ninguém é cancelado.
    expect(participantsToCancel(gravados, new Set(["1"]), new Set())).toEqual([]);
  });
});
