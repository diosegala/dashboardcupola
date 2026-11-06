import { describe, expect, it } from "vitest";
import { batchAt, couponForSeller, invoicedToTickets, isTicketProduct, parseDealTitle, redeemedDeal, sellerFirstName } from "./invoicedTickets";
import { ticketCategory } from "./ticketCategory";
import { splitTickets } from "@/hooks/useCommercialMetrics";
import { buildTeamRanking } from "@/components/dashboard/TeamRanking";

const sympla: any[] = [
  { sold_at: "2026-10-20T12:00:00Z", ticket_type: "Pré-Venda 2027 | Ingresso Padrão", quantity: 1, total_price: 900, status: "approved" },
  { sold_at: "2026-11-03T12:00:00Z", ticket_type: "Lote 0 | Ingresso VIP", quantity: 1, total_price: 1500, status: "approved", coupon_code: "5.00% - ISABELLESA5" },
];

describe("faturados internos (Pipedrive)", () => {
  it("só produto de ingresso do Summit conta", () => {
    expect(isTicketProduct("Ingressos Summit - VIP")).toBe(true);
    expect(isTicketProduct("Cota Prata - Summit")).toBe(false);
    expect(isTicketProduct("Mob Report")).toBe(false);
  });

  it("vendedor pelo primeiro nome do ID do canal de origem", () => {
    expect(sellerFirstName("ISABELLE SALDANHA")).toBe("Isabelle");
    expect(sellerFirstName("Indicação Rodrigo")).toBe("Rodrigo");
    expect(sellerFirstName("")).toBeNull();
  });

  it("lote vigente pela última venda da Sympla até o dia", () => {
    expect(batchAt("2026-11-04T10:00:00Z", sympla)).toBe("Lote 0");
    expect(batchAt("2026-10-25T10:00:00Z", sympla)).toBe("Lote 0"); // faturados nunca entram na Pré-venda
  });

  it("soma na meta, na receita e no ranking da mesma pessoa do cupom", () => {
    const faturados = invoicedToTickets(
      [{ id: "d1", pipedrive_deal_id: "38004", title: "[SUM] Copa Azul Imóveis | 03 ingressos VIP", status: "won", won_at: "2026-11-05T12:00:00Z", custom_fields: { __channel_id: "ISABELLE SALDANHA" } }],
      [{ deal_id: "d1", name: "Ingressos Summit - VIP", quantity: 3, item_price: 1775.65, sum: 5326.95 }],
      sympla,
    );
    const { paying, invoiced } = splitTickets([...sympla, ...faturados]);
    expect(invoiced.reduce((s, t) => s + (t.quantity || 0), 0)).toBe(3);
    expect(paying.reduce((s, t) => s + Number(t.total_price), 0)).toBeCloseTo(900 + 1500 + 5326.95);
    const lote0 = buildTeamRanking(paying).lotes.find((l) => l.lote === "Lote 0")!;
    expect(lote0.ranking).toHaveLength(1);
    expect(lote0.ranking[0].vendas).toBe(4);
  });

  it("lê empresa, quantidade e tipo do título", () => {
    expect(parseDealTitle("[SUM] Copa Azul Imóveis | 03 ingressos VIP")).toMatchObject({ empresa: "Copa Azul Imóveis", quantidade: 3, tipo: "Ingresso VIP" });
  });

  it("título com vários tipos conta cada ingresso no seu tipo", () => {
    const r = parseDealTitle("[SUM] Imob Y | 02 ingressos VIP + 05 padrão + 1 combo VIP");
    expect(r.itens).toEqual([
      { quantidade: 2, tipo: "Ingresso VIP" },
      { quantidade: 5, tipo: "Ingresso Padrão" },
      { quantidade: 1, tipo: "Combo VIP" },
    ]);
    expect(parseDealTitle("[SUM] CUPOLA Summit 2027 | 10 ingressos").itens).toEqual([{ quantidade: 10, tipo: "Ingresso Padrão" }]);
    const vendas = invoicedToTickets(
      [{ id: "d", pipedrive_deal_id: "2", title: "[SUM] Imob Y | 02 ingressos VIP + 05 padrão", status: "won", won_at: "2026-11-05T12:00:00Z", value: 7000, custom_fields: {} }],
      [],
      [],
    );
    expect(vendas.map((v) => [v.ticket_type, v.quantity, v.total_price])).toEqual([["Lote 0 | Ingresso VIP", 2, 2000], ["Pré-venda | Grupo de Ingressos Padrão", 5, 5000]]);
  });

  it("corrige quantidade e preço trocados no produto (Copa Azul: 1775.65 x 3)", () => {
    const [t] = invoicedToTickets(
      [{ id: "d", pipedrive_deal_id: "38004", title: "[SUM] Copa Azul Imóveis | 03 ingressos VIP", status: "won", won_at: "2026-11-05T12:00:00Z", org_name: "Copa Azul Imóveis", custom_fields: {} }],
      [{ deal_id: "d", name: "Ingressos Summit - VIP", quantity: 1775.65, item_price: 3, sum: 5326.95 }],
      [],
    );
    expect(t.quantity).toBe(3);
    expect(t.total_price).toBeCloseTo(5326.95);
    expect(t.conferir).toMatch(/trocados/);
  });

  it("negócio sem produto entra pelo título; aberto fica em negociação", () => {
    const [t] = invoicedToTickets(
      [{ id: "d", pipedrive_deal_id: "1", title: "[SUM] Imob X | 2 ingressos padrão", status: "open", stage_name: "Fechamento", won_at: null, created_at_source: "2026-11-04T12:00:00Z", value: 1800, custom_fields: {} }],
      [],
      [],
    );
    expect(t.quantity).toBe(2);
    expect(ticketCategory(t)).toBe("negociacao");
  });

  it("vendedor do Pipedrive casa com o cupom da equipe", () => {
    const equipe = ["SUELLEN5", "ALINEB5", "ALINEP5", "ALINEPAVEZI5", "ISABELLE5"];
    expect(couponForSeller("Suelen Moreira", equipe)).toBe("SUELLEN5");
    expect(couponForSeller("ISABELLE SALDANHA", equipe)).toBe("ISABELLE5");
    expect(couponForSeller("Aline Borges", equipe)).toBe("ALINEB5");
    expect(couponForSeller("Aline Pavezi", equipe)).toBe("ALINEPAVEZI5");
    // "Indicação Rodrigo" conta para o Rodrigo; só "Indicação", sem nome, não conta para ninguém.
    expect(couponForSeller("Indicação Rodrigo", [...equipe, "RODRIGO5"])).toBe("RODRIGO5");
    expect(couponForSeller("Indicação", equipe)).toBeNull();
    expect(sellerFirstName("Indicação")).toBeNull();
  });

  it("resgate na Sympla com o nome da empresa não duplica a venda", () => {
    const empresas = [{ deal_id: "38004", company: "Copa Azul Imóveis" }];
    expect(redeemedDeal("100.00% - COPAAZUL100", empresas)).toBe("38004");
    expect(redeemedDeal("100.00% - INGRESSO_VIP_COPAZUL100", empresas)).toBe("38004");
    expect(redeemedDeal("100.00% - GANHADORSUMMIT26_BRUNOHANS", empresas)).toBeNull();
    expect(ticketCategory({ status: "approved", coupon_code: "100.00% - COPAAZUL100", redeems: "38004" })).toBe("resgates");
  });
});
