import { describe, expect, it } from "vitest";
import { incompleteOrders, invoiceCompany, keepsTicket, mergeOrders, mergeParticipants, partialSyncMessage, participantPrice, participantsToCancel } from "../../supabase/functions/_shared/sympla-rules";

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

  it("junta 1.5.1 e 1.6.0 por número do ingresso, sem duplicar e mantendo a chave gravada", () => {
    const legado = [{ id: "347614853", ticket_number: "UX9H-CG-5TK5", order_id: "35EA3BTU1UD", ticket_sale_price: 1859.52, first_name: "A" }];
    const atual = [
      { id: "novo-1", ticket_number: "UX9HCG5TK5", order_id: "35EA3BTU1UD", ticket_net_value: 1859.52, first_name: null }, // mesmo ingresso, sem hífen
      { id: "novo-2", ticket_number: "UX86-84-PK4A", order_id: "35EA3BTU1UD", ticket_net_value: 1859.52 }, // faltava na 1.5.1
      { id: "novo-3", ticket_number: null, order_id: "35EA3BTU1UD" }, // sem número: ignorado
    ];
    const { participants, stats } = mergeParticipants(legado, atual, new Map([["UX9HCG5TK5", "347614853"]]), new Set(["35EA3BTU1UD"]));
    expect(participants.map((m) => m.key)).toEqual(["347614853", "novo-2"]);
    expect(participants[0].p.first_name).toBe("A"); // nulo da 1.6.0 não apaga o dado do legado
    expect(stats).toEqual({ semNumero: 1, reconhecidos: 1, descartada: false });
    expect(participants.reduce((s, m) => s + participantPrice(m.p), 0)).toBe(3719.04);
    // O pedido de 2 ingressos VIP fecha com o valor líquido do pedido.
    expect(incompleteOrders([{ id: "35EA3BTU1UD", order_status: "APPROVED", order_total_net_value: 3719.04 }], participants.map((m) => m.p))).toEqual([]);
  });

  it("descarta a 1.6.0 quando ela não reconhece nenhum ingresso já conhecido", () => {
    const legado = [{ id: "1", ticket_number: "AAAA-11-1111" }];
    const atual = [{ id: "x", ticket_number: "formato-diferente" }];
    const { participants, stats } = mergeParticipants(legado, atual, new Map(), new Set());
    expect(participants).toHaveLength(1);
    expect(stats.descartada).toBe(true);
    // Evento novo, sem nada gravado: a 1.6.0 entra inteira.
    expect(mergeParticipants([], atual, new Map(), new Set()).participants).toHaveLength(1);
  });

  // Caso de 10/11/2026: pedido aprovado de 07/11 com 2 ingressos que a lista de pedidos da 1.5.1 não trazia.
  it("junta pedidos da 1.5.1 e da 1.6.0, e o pedido que só a 1.6.0 traz é conferido um a um", () => {
    const legado = [{ id: "35EA3BUZNT2", order_status: "A", order_total_net_value: 2376.69, discount_code: "LETICIAC5" }];
    const atual = [
      { id: "35EA3BUZNT2", order_status: "A", discount_code: null },
      { id: "35EA3BUMQ1S", order_status: "A", order_total_net_value: 1667.86 },
    ];
    const { orders, stats } = mergeOrders(legado, atual);
    expect([...orders.keys()]).toEqual(["35EA3BUZNT2", "35EA3BUMQ1S"]);
    expect(orders.get("35EA3BUZNT2")!.discount_code).toBe("LETICIAC5"); // nulo da 1.6.0 não apaga o cupom
    expect(stats).toEqual({ pedidos_1_6_0: 2, reconhecidos: 1, novos: 1, descartada: false });
    const participantes = [1, 2, 3].map(() => ({ order_id: "35EA3BUZNT2", ticket_sale_price: 792.23 }));
    expect(incompleteOrders([...orders.values()], participantes).map((o) => o.id)).toEqual(["35EA3BUMQ1S"]);
  });

  it("descarta os pedidos da 1.6.0 quando nenhum id bate com a 1.5.1", () => {
    const { orders, stats } = mergeOrders([{ id: "35EA3BUZNT2" }], [{ id: 12345 }]);
    expect([...orders.keys()]).toEqual(["35EA3BUZNT2"]);
    expect(stats.descartada).toBe(true);
    // Sem a 1.5.1, a 1.6.0 entra inteira.
    expect(mergeOrders([], [{ id: "X" }]).orders.size).toBe(1);
  });

  it("aviso de sincronização parcial só quando falta ingresso", () => {
    expect(partialSyncMessage([])).toBeNull();
    expect(partialSyncMessage(["35EA3BUMQ1S"])).toMatch(/^Sync parcial: 1 pedido\(s\).*35EA3BUMQ1S/);
  });

  it("guarda confirmados e pendentes, como a Sympla mostra", () => {
    expect(["A", "APPROVED", "P", "pending"].every(keepsTicket)).toBe(true);
    expect(["NP", "C", "R", "cancelled", null].some(keepsTicket)).toBe(false);
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
