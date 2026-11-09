import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, quotaOfProduct, quotasFromCatalog, type SponsorshipDraft } from "@/lib/sponsorship";
import { closerBreakdown, computeSponsorship, exampleDataset, inEdition, quotaBreakdown, quotaTargets, weeklySeries, type DealProductRow, type DealRow } from "@/lib/sponsorshipMetrics";

// Configuração genérica de teste: nomes inventados, nada do código depende deles.
const config: SponsorshipDraft = {
  ...EMPTY_DRAFT,
  crm_account: "conta",
  product_term: "Feira",
  product_code: "PAT",
  pipelines: [{ pipeline_pd_id: 7, represents: "varias_cotas" }],
  quotas: [
    { key: "ouro", name: "Ouro", order: 1, list_price: 100000, max_slots: 4 },
    { key: "prata", name: "Prata", order: 2, list_price: 50000, max_slots: 3 },
  ],
};
const catalog = [
  { pd_id: 1, name: "Cota Ouro - Feira", code: "PAT" },
  { pd_id: 2, name: "Cota Prata - Feira", code: "PAT" },
  { pd_id: 3, name: "Ingressos Feira", code: "EDU" },
  { pd_id: 4, name: "Relatório anual", code: "PAT" },
  { pd_id: 5, name: "Feira 2027 (final)", code: "PAT" },
];
const deal = (id: string, status: string, won_at: string | null, extra: Partial<DealRow> = {}): DealRow => ({
  id,
  pipedrive_deal_id: id,
  title: `Negócio ${id}`,
  org_name: `Empresa ${id}`,
  status,
  value: 0,
  won_at,
  pipeline_pd_id: 7,
  ...extra,
});
const line = (deal_id: string, product_pd_id: number, sum: number, extra: Partial<DealProductRow> = {}): DealProductRow => ({
  deal_id,
  product_pd_id,
  name: null,
  quantity: 1,
  sum,
  is_enabled: true,
  ...extra,
});
const window = { previousEnd: "2026-05-21", eventEnd: "2027-05-21" };

describe("receita de patrocínio", () => {
  it("soma só os produtos do evento com o código, em negócios ganhos da edição", () => {
    const deals = [deal("a", "won", "2026-08-10T15:00:00Z"), deal("b", "won", "2026-09-01T12:00:00Z")];
    const lines = [line("a", 1, 90000), line("a", 4, 20000), line("a", 3, 1000), line("b", 2, 45000)];
    const m = computeSponsorship(config, deals, lines, catalog, window);
    expect(m.vendido).toBe(135000);
    expect(m.vendas.map((v) => v.cota)).toEqual(["Ouro", "Prata"]);
  });

  it("ganho até o último dia da edição anterior fica fora; o dia seguinte já conta (fuso de São Paulo)", () => {
    // 22/05 01:00 UTC ainda é 21/05 em São Paulo.
    const deals = [deal("a", "won", "2026-05-22T01:00:00Z"), deal("b", "won", "2026-05-22T12:00:00Z")];
    const m = computeSponsorship(config, deals, [line("a", 1, 10), line("b", 1, 20)], catalog, window);
    expect(m.vendido).toBe(20);
    expect(inEdition("2026-05-21T23:00:00-03:00", "2026-05-21", "2027-05-21")).toBe(false);
  });

  it("ganho sem produto do evento fica fora da receita e vai para o aviso", () => {
    const deals = [deal("a", "won", "2026-08-10T15:00:00Z"), deal("b", "won", "2026-08-11T15:00:00Z")];
    const m = computeSponsorship(config, deals, [line("b", 4, 5000)], catalog, window);
    expect(m.vendido).toBe(0);
    expect(m.ganhosSemProduto.map((g) => g.pipedriveDealId)).toEqual(["a", "b"]);
  });

  it("ignora produto desativado, negócio excluído e outros funis", () => {
    const deals = [deal("a", "won", "2026-08-10T15:00:00Z"), deal("b", "won", "2026-08-10T15:00:00Z", { is_deleted: true }), deal("c", "won", "2026-08-10T15:00:00Z", { pipeline_pd_id: 8 })];
    const lines = [line("a", 1, 100, { is_enabled: false }), line("a", 2, 50), line("b", 1, 100), line("c", 1, 100)];
    expect(computeSponsorship(config, deals, lines, catalog, window).vendido).toBe(50);
  });

  it("em negociação soma os produtos do evento dos abertos, ou o valor do aberto ainda sem produto", () => {
    const deals = [deal("a", "open", null), deal("b", "open", null, { value: 30000 }), deal("c", "open", null, { value: 99999 })];
    const lines = [line("a", 2, 50000), line("c", 4, 99999)];
    const m = computeSponsorship(config, deals, lines, catalog, window);
    expect(m.emNegociacao).toBe(80000);
    expect(m.negociosAbertos).toBe(2);
  });

  it("produto do evento sem cota pelo nome fica sem cota (linha Outros produtos do evento)", () => {
    expect(quotaOfProduct("Feira 2027 (final)", config.quotas)).toBeNull();
    expect(quotaOfProduct("Cota Prata - Feira", config.quotas)?.key).toBe("prata");
  });

  it("cotas: vendidas, vagas, em negociação, receita e a linha de outros produtos", () => {
    const deals = [deal("a", "won", "2026-08-10T15:00:00Z"), deal("b", "won", "2026-08-11T15:00:00Z"), deal("c", "open", null)];
    const lines = [line("a", 1, 85000), line("b", 5, 20000), line("c", 1, 100000, { quantity: 2 })];
    const m = computeSponsorship(config, deals, lines, catalog, window);
    const rows = quotaBreakdown(m, config.quotas, { ouro: 4 });
    expect(rows[0]).toMatchObject({ nome: "Ouro", vendidas: 1, meta: 4, restantes: 3, emNegociacao: 2, precoMedio: 85000 });
    expect(rows[1]).toMatchObject({ nome: "Prata", vendidas: 0, meta: null });
    expect(rows[2]).toMatchObject({ key: "", nome: "Outros produtos do evento", vendidas: 1 });
  });

  it("meta por cota: vendido, % da meta e quanto falta, com total só das cotas com meta", () => {
    const deals = [deal("a", "won", "2026-08-10T15:00:00Z"), deal("b", "won", "2026-08-11T15:00:00Z"), deal("c", "open", null)];
    const lines = [line("a", 1, 85000), line("b", 5, 20000), line("c", 1, 100000, { quantity: 2 })];
    const m = computeSponsorship(config, deals, lines, catalog, window);
    const { rows, total } = quotaTargets(quotaBreakdown(m, config.quotas, { ouro: 4 }));
    expect(rows.map((r) => r.nome)).toEqual(["Ouro"]);
    expect(rows[0]).toMatchObject({ meta: 4, vendidas: 1, pct: 0.25, falta: 3, emNegociacao: 2 });
    expect(total).toMatchObject({ meta: 4, vendidas: 1, falta: 3 });
    // Sem nenhuma meta cadastrada, não há total nem falta.
    const semMeta = quotaTargets(quotaBreakdown(m, config.quotas, {}));
    expect(semMeta.total).toBeNull();
    expect(semMeta.rows[0]).toMatchObject({ meta: null, pct: null, falta: null });
    // Passou da meta: falta zera, % passa de 100.
    const passou = quotaTargets(quotaBreakdown(m, config.quotas, { ouro: 1 }));
    expect(passou.rows[0]).toMatchObject({ pct: 1, falta: 0 });
  });

  it("vendas por closer: negócios, cotas, valor e parte do total, sem closer no fim da ordem de valor", () => {
    const mk = (dealId: string, closer: string | null, quantidade: number, valor: number) => ({ dealId, closer, quantidade, valor }) as any;
    const r = closerBreakdown([mk("a", "Ana", 1, 60000), mk("a", "Ana", 2, 20000), mk("b", null, 1, 20000), mk("c", "Bia", 1, 100000)]);
    expect(r.map((x) => x.closer)).toEqual(["Bia", "Ana", "Sem closer"]);
    expect(r[1]).toMatchObject({ negocios: 1, quantidade: 3, valor: 80000 });
    expect(r[0].parte).toBeCloseTo(0.5);
    expect(closerBreakdown([])).toEqual([]);
  });

  it("semanas: acumulado até hoje e ritmo necessário até a abertura", () => {
    const deals = [deal("a", "won", "2026-06-01T15:00:00Z"), deal("b", "won", "2026-06-20T15:00:00Z")];
    const m = computeSponsorship(config, deals, [line("a", 1, 100), line("b", 2, 50)], catalog, window);
    const { semanas, ritmoSemanal, semanasRestantes } = weeklySeries(m, { inicio: "2026-05-22", abertura: "2026-07-31", hoje: "2026-06-25", meta: 450 });
    expect(semanas[0].receita).toBe(0);
    expect(semanas.find((w) => w.inicio > "2026-06-25")?.receita).toBeNull();
    expect(semanas.at(-1)?.ritmo).toBeCloseTo(450);
    expect(ritmoSemanal! * semanasRestantes).toBeCloseTo(300);
  });

  it("o exemplo usa as cotas da configuração e passa pelas mesmas regras", () => {
    const ex = exampleDataset(config, "2026-05-22", "2026-11-04");
    const m = computeSponsorship(ex.config, ex.deals, ex.lines, ex.catalog, window);
    expect(m.vendido).toBeGreaterThan(0);
    expect(new Set(m.vendas.map((v) => v.cota))).toEqual(new Set(["Ouro", "Prata", null]));
    expect(m.ganhosSemProduto).toHaveLength(1);
  });

  it("cotas seguem o catálogo do CRM: nome do CRM, produto novo entra, apagado sai, configuração só dá ordem e vagas", () => {
    const cat = [
      { name: "Cota Ouro - Feira", code: "PAT" },
      { name: "Cota Diamante - Feira", code: "PAT" },
      { name: "Cota Prata - Feira", code: "PAT", is_deleted: true },
      { name: "Cota Bronze - Feira", code: "EDU" },
      { name: "Cota Ouro - Outro Evento", code: "PAT" },
    ];
    const q = quotasFromCatalog(cat, "Feira", "PAT", config.quotas);
    expect(q.map((x) => x.name)).toEqual(["Ouro", "Diamante"]);
    expect(q[0]).toMatchObject({ key: "ouro", order: 1, max_slots: 4 });
    expect(quotasFromCatalog(cat, "Feira", "PAT", config.quotas, new Set(["prata"])).map((x) => x.name)).toContain("Prata");
  });
});


describe("responsáveis", () => {
  it("bate com as barras, conta perdidos da edição e calcula a conversão", async () => {
    const { sponsorDeals, ownerRanking } = await import("@/lib/sponsorshipMetrics");
    const deals = [
      deal("a", "won", "2026-11-05T12:00:00Z", { owner_name: "Kate" }),
      deal("b", "won", "2026-11-06T12:00:00Z", { owner_name: "Michel" }),
      deal("c", "open", null, { owner_name: "Kate", stage_name: "Proposta", stage_changed_at: "2026-11-01T12:00:00Z" }),
      deal("d", "lost", null, { owner_name: "Kate", lost_at: "2026-10-01T12:00:00Z", lost_reason: "" }),
      deal("e", "lost", null, { owner_name: "Kate", lost_at: "2025-10-01T12:00:00Z" }),
    ];
    const lines = [line("a", 1, 100000, { quantity: 2 }), line("b", 2, 50000), line("c", 2, 0), line("d", 1, 100000)];
    const w = { previousEnd: "2026-05-30", eventEnd: "2027-05-22" };
    const m = computeSponsorship(config, deals, lines, catalog, w);
    const rows = sponsorDeals(config, m, deals, lines, catalog, w, "2026-11-09");
    for (const r of quotaBreakdown(m, config.quotas, {})) {
      const rk = ownerRanking(rows, r.key, "valor");
      expect(rk.reduce((s, o) => s + o.cotasVendidas, 0)).toBe(r.vendidas);
      expect(rk.reduce((s, o) => s + o.emNegociacao, 0)).toBe(r.emNegociacao);
    }
    const kate = ownerRanking(rows, null, "valor").find((o) => o.owner === "Kate")!;
    expect(kate.perdidos).toBe(1);
    expect(kate.conversao).toBe(0.5);
    const aberto = rows.find((r) => r.status === "negociacao")!;
    expect(aberto.valor).toBeNull();
    expect(aberto.diasNaEtapa).toBe(8);
    expect(rows.find((r) => r.status === "perdido")!.motivo).toBeNull();
  });
  it("nomes: primeiro nome, Leticia Bello e desempate pela inicial", async () => {
    const { ownerDisplayNames } = await import("@/lib/sponsorshipMetrics");
    const n = ownerDisplayNames(["KEITY souza", "Leticia C. Bello Pinguelli", "Ana Paula Prado", "Ana Lima", "Leticia Bellotti"]);
    expect(n.get("KEITY souza")).toBe("Keity");
    expect(n.get("Leticia C. Bello Pinguelli")).toBe("Leticia Bello");
    expect(n.get("Leticia Bellotti")).toBe("Leticia B.");
    expect(n.get("Ana Paula Prado")).toBe("Ana P.");
    expect(n.get("Ana Lima")).toBe("Ana L.");
  });
});
