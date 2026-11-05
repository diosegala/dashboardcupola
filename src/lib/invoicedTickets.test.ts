import { describe, expect, it } from "vitest";
import { batchAt, invoicedToTickets, isTicketProduct, sellerFirstName } from "./invoicedTickets";
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
    expect(batchAt("2026-10-25T10:00:00Z", sympla)).toBe("Pré-venda");
  });

  it("soma na meta, na receita e no ranking da mesma pessoa do cupom", () => {
    const faturados = invoicedToTickets(
      [{ id: "d1", pipedrive_deal_id: "38004", title: "Copa Azul", won_at: "2026-11-05T12:00:00Z", custom_fields: { __channel_id: "ISABELLE SALDANHA" } }],
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
});
