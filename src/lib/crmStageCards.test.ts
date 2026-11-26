import { describe, expect, it } from "vitest";
import { contarCardsEtapa } from "./crmStageCards";

const produto = (name: string, is_enabled = true) => ({ name, is_enabled });

describe("cards do Summit por etapa", () => {
  it("conta cada card uma vez, só em Negociação e Fechamento", () => {
    expect(
      contarCardsEtapa([
        { id: "1", stage_name: "Negociação", deal_products: [produto("Cota Ouro - Summit"), produto("Ingressos Summit - VIP")] },
        { id: "2", stage_name: "Fechamento", deal_products: [produto("Ingressos Summit - Padrão")] },
        { id: "3", stage_name: "Lead", deal_products: [produto("Cota Prata - Summit")] },
        { id: "4", stage_name: "Reunião", deal_products: [produto("Cota Platina - Summit")] },
      ]),
    ).toEqual({ negociacao: 1, fechamento: 1, total: 2 });
  });

  it("card sem produto do Summit fica fora; produto desativado também", () => {
    expect(
      contarCardsEtapa([
        { id: "a", stage_name: "Negociação", deal_products: [produto("Cota - Insider Vendas")] },
        { id: "b", stage_name: "Negociação", deal_products: [produto("Cota Ouro - Summit", false)] },
        { id: "c", stage_name: "Negociação", deal_products: [] },
      ]),
    ).toEqual({ negociacao: 0, fechamento: 0, total: 0 });
  });

  it("aceita acentos, maiúsculas e espaços na etapa", () => {
    expect(
      contarCardsEtapa([
        { id: "x", stage_name: " NEGOCIAÇÃO ", deal_products: [produto("Cota Essencial - Summit")] },
        { id: "y", stage_name: "fechamento", deal_products: [produto("Ingressos Summit")] },
      ]),
    ).toEqual({ negociacao: 1, fechamento: 1, total: 2 });
  });
});
