import { describe, expect, it } from "vitest";
import { beforeEach } from "vitest";
import { couponCodes, couponLabel, outsideTeamBySeller, parseCoupon, setCouponPeople, teamMemberName } from "@/lib/coupons";
import { buildTeamRanking } from "@/components/dashboard/TeamRanking";
import type { Ticket } from "@/hooks/useCommercialMetrics";

const venda = (coupon_code: string | null, extra: Partial<Ticket> = {}): Ticket =>
  ({ coupon_code, quantity: 1, total_price: 100, ticket_type: "Lote 0 | Ingresso Padrão", sold_at: "2026-11-01T12:00:00Z", status: "approved", source: "sympla", ...extra }) as Ticket;

// Mesmo cadastro que está em Configurações › Cupons e vendedores.
beforeEach(() => {
  setCouponPeople([
    { name: "Leticia B", codes: ["LETICIAC5", "LETICIA10", "LETICIA15"], sellerNames: ["Leticia Bello", "Leticia Pinguelli", "Leticia Caetana"], outsideRanking: true },
  ]);
});

describe("Letícia Bello fora do ranking da equipe", () => {
  it("LETICIA10 conta como o mesmo cupom de LETICIAC5", () => {
    expect(parseCoupon("10.00% - LETICIA10")?.code).toBe("LETICIAC5");
    expect(parseCoupon("15.00% - LETICIA15")?.code).toBe("LETICIAC5");
    expect(couponLabel("LETICIAC5")).toBe("Leticia B");
    expect(couponCodes("LETICIAC5")).toBe("LETICIAC5 + LETICIA10 + LETICIA15");
  });

  it("os cupons da Bello ficam na Equipe CUPOLA", () => {
    expect(parseCoupon("5.00% - LETICIAC5")?.group).toBe("equipe");
    expect(parseCoupon("10.00% - LETICIA10")?.group).toBe("equipe");
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

describe("pessoas cadastradas pelos admins", () => {
  it("cupons da mesma pessoa somam juntos e ela segue no ranking quando não está marcada como fora", () => {
    setCouponPeople([{ name: "Suellen", codes: ["SUELLEN5", "SUELLEN10"], sellerNames: ["Suelen Moreira"], outsideRanking: false }]);
    expect(parseCoupon("10.00% - SUELLEN10")).toMatchObject({ code: "SUELLEN5", group: "equipe" });
    expect(teamMemberName("SUELLEN5")).toBe("Suellen");
    const r = buildTeamRanking([
      venda("5.00% - SUELLEN5"),
      venda("10.00% - SUELLEN10"),
      venda(null, { source: "pipedrive", seller: "SUELEN MOREIRA", seller_name: "Suelen" } as Partial<Ticket>),
    ]);
    expect(r.lotes.flatMap((l) => l.ranking.map((v) => ({ nome: v.nome, vendas: v.vendas })))).toEqual([{ nome: "Suellen", vendas: 3 }]);
  });

  it("marcar a pessoa como fora do ranking tira todas as vendas dela", () => {
    setCouponPeople([{ name: "Ana Souza", codes: ["ANAS5"], sellerNames: ["Ana Souza"], outsideRanking: true }]);
    const r = buildTeamRanking([venda("5.00% - ANAS5"), venda(null, { source: "pipedrive", seller: "Ana Souza", seller_name: "Ana" } as Partial<Ticket>)]);
    expect(r.lotes.flatMap((l) => l.ranking)).toEqual([]);
  });
});

describe("nomes padronizados da planilha", () => {
  beforeEach(() => {
    setCouponPeople([
      { name: "Kariny", codes: ["KARINY5"], sellerNames: [], outsideRanking: false },
      { name: "Aline B", codes: ["ALINEB5"], sellerNames: [], outsideRanking: false },
      { name: "Erica", codes: ["ERICA"], sellerNames: [], outsideRanking: false },
    ]);
  });
  it("mostra o nome de quem concedeu e, sem cadastro, o código completo", () => {
    expect(couponLabel("KARINY5")).toBe("Kariny");
    expect(couponLabel("ALINEB5")).toBe("Aline B");
    expect(couponLabel("SECOVIPR5")).toBe("SECOVIPR5");
  });
  it("colaborador cadastrado fica na Equipe CUPOLA mesmo sem o 5 no código", () => {
    expect(parseCoupon("5.00% - ERICA")?.group).toBe("equipe");
  });
});
