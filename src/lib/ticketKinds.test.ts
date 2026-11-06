import { describe, expect, it } from "vitest";
import { ticketKind } from "./ticketKinds";

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
