import { describe, expect, it } from "vitest";
import { crmInProgress } from "./crmInProgress";

const open = { source: "pipedrive", status: "crm_open" };

describe("CRM em andamento", () => {
  it("exclui Leads: 22 + 2 ingressos em dois cards, não 26", () => {
    expect(crmInProgress([
      { ...open, deal_id: "38531", stage_name: "Negociação", quantity: 22 },
      { ...open, deal_id: "37590", stage_name: "Negociação", quantity: 2 },
      { ...open, deal_id: "37729", stage_name: "Lead", quantity: 1 },
      { ...open, deal_id: "38048", stage_name: "Lead", quantity: 1 },
    ])).toEqual({ ingressos: 24, cards: 2 });
  });

  it("um card com vários produtos conta uma vez; aceita Fechamento", () => {
    expect(crmInProgress([
      { ...open, deal_id: "a", stage_name: " Negociação ", quantity: 2 },
      { ...open, deal_id: "a", stage_name: "Negociação", quantity: 3 },
      { ...open, deal_id: "b", stage_name: "Fechamento", quantity: 1 },
    ])).toEqual({ ingressos: 6, cards: 2 });
  });

  it("não inclui ganhos, Sympla ou outras etapas", () => {
    expect(crmInProgress([
      { ...open, status: "approved", deal_id: "a", stage_name: "Fechamento", quantity: 5 },
      { source: "sympla", status: "PENDING", deal_id: "b", stage_name: "Negociação", quantity: 7 },
      { ...open, deal_id: "c", stage_name: "Reunião", quantity: 3 },
    ])).toEqual({ ingressos: 0, cards: 0 });
  });
});