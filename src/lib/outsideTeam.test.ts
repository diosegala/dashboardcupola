import { describe, expect, it } from "vitest";
import { couponLabel, outsideTeamBySeller, parseCoupon } from "@/lib/coupons";
import { buildTeamRanking } from "@/components/dashboard/TeamRanking";
import type { Ticket } from "@/hooks/useCommercialMetrics";

const venda = (coupon_code: string | null, extra: Partial<Ticket> = {}): Ticket =>
  ({ coupon_code, quantity: 1, total_price: 100, ticket_type: "Lote 0 | Ingresso Padrão", sold_at: "2026-11-01T12:00:00Z", status: "approved", source: "sympla", ...extra }) as Ticket;

describe("Letícia Bello fora do ranking da equipe", () => {
  it("LETICIA10 conta como o mesmo cupom de LETICIAC5", () => {
    expect(parseCoupon("10.00% - LETICIA10")?.code).toBe("LETICIAC5");
    expect(couponLabel("LETICIAC5")).toBe("LETICIAC5 + LETICIA10");
  });

  it("os cupons da Bello não ficam no grupo da equipe", () => {
    expect(parseCoupon("5.00% - LETICIAC5")?.group).toBe("parceiro");
    expect(parseCoupon("10.00% - LETICIA10")?.group).toBe("parceiro");
  });

  it("LETICIAA5 (Letícia Ardigó) segue como equipe", () => {
    expect(parseCoupon("5.00% - LETICIAA5")?.group).toBe("equipe");
    expect(outsideTeamBySeller("Letícia Ardigó da Trindade")).toBeNull();
  });

  it("faturado da Bello no Pipedrive é reconhecido pelo nome", () => {
    expect(outsideTeamBySeller("LETICIA BELLO")).toBe("LETICIAC5");
    expect(outsideTeamBySeller("Leticia Caetana Bello Pinguelli")).toBe("LETICIAC5");
  });

  it("vendas da Bello não aparecem no ranking; as da Ardigó sim", () => {
    const r = buildTeamRanking([
      venda("5.00% - LETICIAC5"),
      venda("10.00% - LETICIA10"),
      venda(null, { source: "pipedrive", seller: "LETICIA BELLO", seller_name: "Leticia" } as Partial<Ticket>),
      venda("5.00% - LETICIAA5"),
    ]);
    const nomes = r.lotes.flatMap((l) => l.ranking.map((v) => ({ nome: v.nome, vendas: v.vendas })));
    expect(nomes).toEqual([{ nome: "Leticia", vendas: 1 }]);
  });
});
