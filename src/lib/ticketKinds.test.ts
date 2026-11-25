import { describe, expect, it } from "vitest";
import { knownTicketKind, ticketKind, unclassifiedProducts } from "./ticketKinds";
import { COUNTS_ON_GOAL, ticketCategory } from "./ticketCategory";

// Nomes reais da Sympla (06/11/2026), nas duas versões da API.
describe("ticketKind", () => {
  it("lotes por faixa de quantidade são Grupo", () => {
    expect(ticketKind("Lote 0 | 10% OFF - 2 a 5 Ingressos Padrão")).toBe("Grupo");
    expect(ticketKind("Lote 0 | 15% OFF - 6 a 10 Ingressos Padrão")).toBe("Grupo");
    expect(ticketKind("Ingressos em grupos | Lote 0 | 10% OFF - 2 a 5 Ingressos Padrão")).toBe("Grupo");
  });
  it("combo pelo nome antigo e pelo novo", () => {
    expect(ticketKind("Lote 0 | Combo Padrão (dias 19, 20 e 21)")).toBe("Padrão Combo");
    expect(ticketKind("Lote 0 | Padrão + Visita (dias 19, 20 e 21)")).toBe("Padrão Combo");
  });
  it("individuais seguem Padrão e VIP", () => {
    expect(ticketKind("Ingressos individuais | Lote 0 | Ingresso Padrão (dias 20 e 21)")).toBe("Padrão");
    expect(ticketKind("Lote 0 | Ingresso VIP (dias 20 e 21)")).toBe("VIP");
    expect(ticketKind("Pré-Venda 2027 | Ingresso Padrão (21 e 22/05)")).toBe("Padrão");
  });
});

// Os 17 produtos do Summit 27 na Sympla (25/11/2026), um a um.
describe("produtos do Summit 27", () => {
  const casos: [string, string][] = [
    ["Lote 0 | 10% OFF - 2 a 5 - Padrão", "Grupo"],
    ["Lote 0 | 10% OFF - 2 a 5 Ingressos Padrão", "Grupo"],
    ["Lote 0 | 15% OFF - 6 a 10 Ingressos Padrão", "Grupo"],
    ["Lote 0 | Combo Padrão (dias 19, 20 e 21)", "Padrão Combo"],
    ["Lote 0 | Ingresso Padrão (dias 20 e 21)", "Padrão"],
    ["Lote 0 | Ingresso VIP (dias 20 e 21)", "VIP"],
    ["Lote 0 | Padrão (dias 20 e 21)", "Padrão"],
    ["Lote 0 | Padrão + Visita (dias 19, 20 e 21)", "Padrão Combo"],
    ["Lote 0 | VIP (dias 20 e 21)", "VIP"],
    ["Lote 1 | 10% OFF - a partir de 3 - Padrão", "Grupo"],
    ["Lote 1 | 10% OFF - a partir de 3 - VIP", "Grupo"],
    ["Lote 1 | Padrão (dias 20 e 21)", "Padrão"],
    ["Lote 1 | Padrão + Visita (dias 19, 20 e 21)", "Padrão Combo"],
    ["Lote 1 | VIP (dias 20 e 21)", "VIP"],
    ["Lote 1 | VIP + Visita (dias 19, 20 e 21)", "VIP Combo"],
    ["Lote 1 | Visita (dia 19)", "Visita presencial"],
    ["Pré-Venda 2027 | Ingresso Padrão (21 e 22/05)", "Padrão"],
  ];
  it.each(casos)("%s → %s", (nome, tipo) => expect(knownTicketKind(nome)).toBe(tipo));
  it("produto desconhecido não é encaixado por semelhança", () => {
    expect(knownTicketKind("Lote 2 | Workshop Imersão")).toBeNull();
    expect(unclassifiedProducts([{ ticket_type: "Lote 2 | Workshop Imersão", quantity: 2 }])).toEqual([{ nome: "Lote 2 | Workshop Imersão", quantidade: 2 }]);
  });
});

describe("visita avulsa fora dos pagantes", () => {
  it("visita paga vira categoria visitas; combo segue pago", () => {
    expect(ticketCategory({ status: "APPROVED", ticket_type: "Lote 1 | Visita (dia 19)", unit_price: 2060 })).toBe("visitas");
    expect(ticketCategory({ status: "APPROVED", ticket_type: "Lote 1 | VIP + Visita (dias 19, 20 e 21)", unit_price: 4045 })).toBe("pagos");
    expect(COUNTS_ON_GOAL).not.toContain("visitas");
  });
});
