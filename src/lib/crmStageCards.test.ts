import { describe, expect, it } from "vitest";
import { contarCardsEtapa, funisDeIngressos, type DealEtapa } from "./crmStageCards";

const card = (id: string, overrides: Partial<DealEtapa> = {}): DealEtapa => ({
  id, pipeline_pd_id: 50, status: "open", is_deleted: false, stage_name: "Negociação", ...overrides,
});

describe("cards de Educação por etapa", () => {
  it("seleciona o funil de ingressos e nunca o de patrocínios/cotas", () => {
    expect(funisDeIngressos([
      { pipeline_pd_id: 13, represents: "varias_cotas" },
      { pipeline_pd_id: 50, represents: "ingressos" },
    ])).toEqual([50]);
    expect(contarCardsEtapa([card("educacao"), card("cota", { pipeline_pd_id: 13 })], [50]))
      .toEqual({ negociacao: 1, fechamento: 0, total: 1 });
  });

  it("conta cards sem produto e cada card uma única vez", () => {
    expect(contarCardsEtapa([card("1"), card("1"), card("2", { stage_name: "Fechamento" })], [50]))
      .toEqual({ negociacao: 1, fechamento: 1, total: 2 });
  });

  it("exclui Leads e qualquer etapa fora de Negociação e Fechamento", () => {
    expect(contarCardsEtapa([card("1", { stage_name: "Lead" }), card("2", { stage_name: "Reunião" })], [50]))
      .toEqual({ negociacao: 0, fechamento: 0, total: 0 });
  });

  it("exclui ganhos, perdidos e excluídos", () => {
    expect(contarCardsEtapa([card("1", { status: "won" }), card("2", { status: "lost" }), card("3", { is_deleted: true })], [50]))
      .toEqual({ negociacao: 0, fechamento: 0, total: 0 });
  });

  it("normaliza acentos, maiúsculas e espaços na etapa", () => {
    expect(contarCardsEtapa([card("1", { stage_name: " NEGOCIAÇÃO " }), card("2", { stage_name: "fechamento" })], [50]))
      .toEqual({ negociacao: 1, fechamento: 1, total: 2 });
  });

  it("sem funil de ingressos configurado não adivinha outro funil", () => {
    expect(funisDeIngressos(null)).toEqual([]);
    expect(contarCardsEtapa([card("1")], [])).toEqual({ negociacao: 0, fechamento: 0, total: 0 });
  });
});