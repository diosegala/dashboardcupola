import { beforeEach, describe, expect, it } from "vitest";
import { setCouponPeople } from "@/lib/coupons";
import { canalDe, cupomDePatrocinador, metaDoCanal, vendasPorCanal } from "@/lib/salesChannel";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf } from "@/lib/batches";

const v = (extra: Partial<Ticket> = {}): Ticket =>
  ({ coupon_code: null, quantity: 1, total_price: 100, unit_price: 100, ticket_type: "Lote 0 | Ingresso Padrão", sold_at: "2026-11-01T12:00:00Z", status: "approved", source: "sympla", ...extra }) as Ticket;

beforeEach(() => {
  setCouponPeople([
    { name: "Leticia B", codes: ["LETICIAC5", "LETICIA10", "LETICIA15"], sellerNames: ["Leticia Bello"], outsideRanking: true },
    { name: "Kariny", codes: ["KARINY5"], sellerNames: ["Kariny"], outsideRanking: false },
  ]);
});

describe("canal de venda", () => {
  it("link com bdr e cupom da equipe → BDR", () => expect(canalDe(v({ utm_source: "linkedin", utm_medium: "bdr", coupon_code: "5.00% - KARINY5" }))).toBe("BDR"));
  it("UTM tem prioridade sobre o cupom", () => expect(canalDe(v({ utm_source: "rd-station", utm_medium: "email", coupon_code: "5.00% - KARINY5" }))).toBe("E-mail marketing"));
  it("LETICIA10 sem link → BDR", () => expect(canalDe(v({ coupon_code: "10.00% - LETICIA10" }))).toBe("BDR"));
  it("LETICIAA5 sem link → Equipe CUPOLA", () => expect(canalDe(v({ coupon_code: "5.00% - LETICIAA5" }))).toBe("Equipe CUPOLA"));
  it("cupom marcado como de patrocinador sem link → Patrocinadores", () => expect(canalDe(v({ coupon_code: "40.00% - MAXIMIZA40", sponsor_coupon: true }))).toBe("Patrocinadores"));
  it("UTM tem prioridade sobre cupom de patrocinador", () => expect(canalDe(v({ utm_source: "rd-station", utm_medium: "email", coupon_code: "MAXIMIZA40", sponsor_coupon: true }))).toBe("E-mail marketing"));
  it("nome da empresa patrocinadora vira cupom", () => {
    expect(cupomDePatrocinador("40.00% - MAXIMIZA40", ["Maximiza Imóveis Ltda"])).toBe(true);
    expect(cupomDePatrocinador("40.00% - MAXIMIZA40", ["Outra Empresa"])).toBe(false);
    expect(cupomDePatrocinador("5.00% - KARINY5", ["Kariny Imóveis"])).toBe(false);
  });
  it("faturado da Bello → BDR", () => expect(canalDe(v({ source: "pipedrive", seller: "Leticia Bello" }))).toBe("BDR"));
  it("faturado de outro vendedor → Equipe CUPOLA", () => expect(canalDe(v({ source: "pipedrive", seller: "Kariny Silva" }))).toBe("Equipe CUPOLA"));
  it("sem link e sem cupom → Sem canal identificado", () => expect(canalDe(v())).toBe("Sem canal identificado"));
  it("venda cancelada fica fora e a soma bate com os pagantes", () => {
    const lista = [v({ utm_source: "instagram" }), v({ status: "cancelled", utm_source: "instagram" }), v(), v({ coupon_code: "5.00% - KARINY5" })];
    const pagantes = splitTickets(lista).paying;
    const canais = vendasPorCanal(pagantes);
    expect(canais.reduce((s, c) => s + c.value, 0)).toBe(3);
    expect(canais.find((c) => c.label === "Redes sociais")?.value).toBe(1);
  });
  it("meta do canal no lote; em Evento todo soma os lotes", () => {
    const goals = [{ metric_key: "channel_sales", quota_key: "BDR", ticket_type: "Lote 0", target_value: 10 }, { metric_key: "channel_sales", quota_key: "BDR", ticket_type: "Lote 1", target_value: 5 }];
    expect(metaDoCanal(goals, "BDR", "Lote 0", batchOf)).toBe(10);
    expect(metaDoCanal(goals, "BDR", null, batchOf)).toBe(15);
    expect(metaDoCanal(goals, "Anúncios", "Lote 0", batchOf)).toBeNull();
  });
});
