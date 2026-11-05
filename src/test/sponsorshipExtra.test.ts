import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, type SponsorshipDraft } from "@/lib/sponsorship";
import { computeSponsorship, type DealRow } from "@/lib/sponsorshipMetrics";
import { deliveries, documentType, eventShare, fieldStatuses, fieldText, prospecting, receipts, renewals, valueEvolution } from "@/lib/sponsorshipExtra";

// Configuração genérica de teste: nomes inventados, nada do código depende deles.
const config: SponsorshipDraft = {
  ...EMPTY_DRAFT,
  crm_account: "conta",
  product_term: "Feira",
  product_code: "PAT",
  pipelines: [{ pipeline_pd_id: 7, represents: "varias_cotas" }],
  quotas: [{ key: "ouro", name: "Ouro", order: 1, list_price: null, max_slots: null }],
  deliverables: [
    { key: "marca", name: "Marca", days_before_event: 30 },
    { key: "cupom", name: "Cupom", days_before_event: null },
  ],
  field_mapping: {
    payment_method: { object: "deal", field_key: "pg", field_type: "enum", name: "Forma de pagamento", options: [{ id: 1, label: "Boleto" }, { id: 2, label: "Permuta" }] },
    installments_count: { object: "deal", field_key: "np", field_type: "varchar", name: "Número de parcelas" },
    first_due_date: { object: "deal", field_key: "fv", field_type: "date", name: "1º vencimento" },
    deliveries: { object: "deal", field_key: "en", field_type: "set", name: "Entregas", options: [{ id: 10, label: "Marca" }] },
  },
  crm_read: { read_at: "2026-11-01T00:00:00Z", labels: [{ id: 5, label: "Quente" }] },
};
const catalog = [{ pd_id: 1, name: "Cota Ouro - Feira", code: "PAT" }];
const window = { previousEnd: "2026-05-21", eventEnd: "2027-05-21" };
const deal = (id: string, extra: Partial<DealRow>): DealRow => ({ id, pipedrive_deal_id: id, title: null, org_name: `Empresa ${id}`, status: "won", value: 0, won_at: "2026-08-01T15:00:00Z", pipeline_pd_id: 7, ...extra });
const line = (deal_id: string, sum: number) => ({ deal_id, product_pd_id: 1, name: null, quantity: 1, sum, is_enabled: true });

describe("campos do CRM", () => {
  it("diz se o campo não existe, está vazio ou preenchido em parte", () => {
    const won = [deal("a", { custom_fields: { pg: 1 } }), deal("b", { custom_fields: {} })];
    const st = fieldStatuses(config, won, new Map());
    expect(st.find((s) => s.key === "payment_method")).toMatchObject({ state: "parcial", preenchidos: 1, total: 2 });
    expect(st.find((s) => s.key === "first_due_date")?.state).toBe("vazio");
    expect(st.find((s) => s.key === "sdr")?.state).toBe("nao_existe");
    expect(fieldStatuses({ ...config, crm_read: { read_at: null, labels: [] } }, won, new Map())[0].state).toBe("nao_lida");
  });

  it("traduz opção, data e mostra só o tipo do documento", () => {
    expect(fieldText(config.field_mapping.payment_method, 2, new Map())).toBe("Permuta");
    expect(fieldText(config.field_mapping.first_due_date, "2026-12-10", new Map())).toBe("10/12/26");
    expect(documentType("12.345.678/0001-90")).toBe("CNPJ");
    expect(documentType("123.456.789-01")).toBe("CPF");
  });
});

describe("recebimentos", () => {
  it("usa parcelas do Pipedrive, senão parcelas e 1º vencimento, e deixa a permuta fora", () => {
    const deals = [
      deal("a", {}),
      deal("b", { custom_fields: { np: "2", fv: "2026-11-15" } }),
      deal("c", { custom_fields: { pg: 2 } }),
      deal("d", {}),
    ];
    const m = computeSponsorship(config, deals, [line("a", 100), line("b", 200), line("c", 300), line("d", 50)], catalog, window);
    const r = receipts(config, m, new Map(deals.map((d) => [d.id, d])), [{ deal_id: "a", amount: 100, billing_date: "2026-10-05" }], "2027-05-21");
    expect(r.porMes).toEqual([
      { mes: "2026-10", valor: 100 },
      { mes: "2026-11", valor: 100 },
      { mes: "2026-12", valor: 100 },
    ]);
    expect(r.permuta).toBe(300);
    expect(r.semCondicao).toBe(50);
    expect(r.fonte).toBe("misto");
  });
});

describe("prospecção", () => {
  const stages = [0, 1, 2].map((i) => ({ pd_id: 100 + i, pipeline_pd_id: 7, name: `Etapa ${i + 1}`, order_nr: i + 1, days_to_rotten: null }));
  it("conta abertos por etapa, quem chegou em cada uma, quentes e motivos de perda", () => {
    const deals = [
      deal("a", { status: "open", won_at: null, stage_id: "100", value: 10, owner_name: "A" }),
      deal("b", { status: "open", won_at: null, stage_id: "102", value: 20, owner_name: "B", label_ids: [5] }),
      deal("c", { status: "lost", won_at: null, lost_at: "2026-09-01T12:00:00Z", stage_id: "101", lost_reason: "Sem verba", owner_name: "A" }),
      deal("d", { status: "lost", won_at: null, lost_at: "2026-09-02T12:00:00Z", stage_id: "100", lost_reason: null, owner_name: "A" }),
      deal("e", { status: "won", stage_id: "102", owner_name: "B" }),
      deal("velho", { status: "lost", won_at: null, lost_at: "2025-09-02T12:00:00Z", stage_id: "100" }),
    ];
    const p = prospecting(config, deals, stages, window, "2026-11-05", null);
    expect(p.abordadas).toBe(5);
    expect(p.etapas.map((e) => e.abertos)).toEqual([1, 0, 1]);
    expect(p.etapas.map((e) => e.chegaram)).toEqual([5, 3, 2]);
    expect(p.quentes).toBe(1);
    expect(p.conversao).toBeCloseTo(1 / 4);
    expect(p.perdidosSemMotivo).toBe(1);
    expect(prospecting(config, deals, stages, window, "2026-11-05", "B").abordadas).toBe(2);
  });
});

describe("renovação e entregas", () => {
  it("classifica os patrocinadores da edição anterior e soma a receita em risco", () => {
    const deals = [
      deal("p1", { org_pd_id: 1, won_at: "2025-10-01T12:00:00Z", value: 100 }),
      deal("p2", { org_pd_id: 2, won_at: "2025-10-01T12:00:00Z", value: 100 }),
      deal("p3", { org_pd_id: 3, won_at: "2025-10-01T12:00:00Z", value: 100 }),
      deal("n1", { org_pd_id: 1 }),
      deal("o2", { org_pd_id: 2, status: "open", won_at: null }),
    ];
    const m = computeSponsorship(config, deals, [line("n1", 150)], catalog, window);
    const r = renewals(config, deals, [line("n1", 150)], catalog, m, { inicio: "2025-05-21", fim: "2026-05-21" });
    expect(Object.fromEntries(r.map((x) => [x.orgId, x.estado]))).toEqual({ 1: "subiu", 2: "negociando", 3: "sem_negocio" });
  });

  it("marca a entrega pelo campo e o cupom pela Sympla", () => {
    const deals = [deal("a", { org_name: "Imobiliária Exemplar", custom_fields: { en: [10] } }), deal("b", { org_name: "Outra Casa" })];
    const m = computeSponsorship(config, deals, [line("a", 1), line("b", 1)], catalog, window);
    const rows = deliveries(config, m, new Map(deals.map((d) => [d.id, d])), ["IMOBILIARIAEXEMPLAR10"]);
    expect(rows.find((r) => r.empresa.startsWith("Imob"))?.feitas).toEqual({ marca: true, cupom: true });
    expect(rows.find((r) => r.empresa === "Outra Casa")?.feitas).toEqual({ marca: false, cupom: false });
  });
});

describe("funil compartilhado com outros eventos", () => {
  it("conta o negócio com produto do evento e o sem produto; o de outro evento fica fora", () => {
    const cat = [...catalog, { pd_id: 2, name: "Cota Ouro - Outro Evento", code: "PAT" }];
    const linhas = [line("a", 10), { deal_id: "b", product_pd_id: 2, name: null, quantity: 1, sum: 20, is_enabled: true }];
    const share = eventShare(config, linhas, cat);
    expect(share(deal("a", {}))).toMatchObject({ doEvento: true, valor: 10, comProduto: true });
    expect(share(deal("b", {})).doEvento).toBe(false);
    expect(share(deal("c", { value: 5 }))).toMatchObject({ doEvento: true, valor: 5, comProduto: false });
    expect(share(deal("d", { products_count: 2 })).doEvento).toBe(false);
  });
});

describe("evolução do valor em negociação", () => {
  it("soma o último valor de cada negócio aberto, lista a mudança e tira o negócio quando ele fecha", () => {
    const deals = new Map([
      ["a", deal("a", { status: "open", won_at: null })],
      ["b", deal("b", { status: "won", won_at: "2026-11-03T15:00:00Z" })],
    ]);
    const h = (deal_id: string, sum: number, at: string, product_pd_id = 1) => ({ deal_id, deal_product_pd_id: deal_id === "a" ? 10 : 20, product_pd_id, sum, is_enabled: true, changed_at: at });
    const ev = valueEvolution(
      [h("a", 0, "2026-11-01T12:00:00Z"), h("b", 50, "2026-11-01T12:00:00Z"), h("a", 30, "2026-11-02T12:00:00Z"), h("a", 99, "2026-11-02T13:00:00Z", 2)],
      deals,
      (pid) => pid === 1,
      "2026-11-04",
    );
    expect(ev.serie).toEqual([
      { dia: "2026-11-01", valor: 50 },
      { dia: "2026-11-02", valor: 80 },
      { dia: "2026-11-03", valor: 30 },
      { dia: "2026-11-04", valor: 30 },
    ]);
    expect(ev.mudancas).toEqual([{ dealId: "a", empresa: "Empresa a", de: 0, para: 30, em: "2026-11-02" }]);
  });
});

