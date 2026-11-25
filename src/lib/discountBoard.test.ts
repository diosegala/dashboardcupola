import { describe, expect, it } from "vitest";
import { descontoPonderado, resumoDesconto, taxaDaSympla, type LotePreco, type VendaDesconto } from "./lotPricing";
import { alertasCrmDesconto, foraDoDesconto } from "./discountExclusions";
import { lotesParaLista } from "./batches";

const lotes: LotePreco[] = [{ name: "Lote 0", price_standard: 1000, price_vip: 2000 }];
const venda = (extra: Partial<VendaDesconto>): VendaDesconto => ({
  produto: "Lote 0 | Ingresso Padrão (dias 20 e 21)",
  quantidade: 1,
  pago: 900,
  fonte: "sympla",
  ...extra,
});

describe("quadro de desconto", () => {
  it("usa a mesma classificação de canal também para faturados", () => {
    const r = resumoDesconto([
      venda({ canal: "E-mail marketing" }),
      venda({ fonte: "pipedrive", canal: "Equipe CUPOLA", pago: 800 }),
    ], lotes);
    expect(r.porCanal.find((c) => c.canal === "E-mail marketing")?.soma.ingressos).toBe(1);
    expect(r.porCanal.find((c) => c.canal === "Equipe CUPOLA")?.soma.ingressos).toBe(1);
  });

  it("mostra o desconto do mês e o acumulado ponderado até ali", () => {
    const r = resumoDesconto([
      venda({ vendidoEm: "2026-10-10T12:00:00Z", pago: 900 }),
      venda({ vendidoEm: "2026-11-10T12:00:00Z", pago: 1000 }),
    ], lotes);
    expect(descontoPonderado(r.porMes[0].soma)).toBeCloseTo(0.1);
    expect(descontoPonderado(r.porMes[1].soma)).toBe(0);
    expect(descontoPonderado(r.porMes[1].acumulada)).toBeCloseTo(0.05);
    expect(r.porMes[1].acumulada.ingressos).toBe(2);
  });

  it("taxa fica fora do desconto e usa o valor pago pelo cliente como base", () => {
    const vendas = [venda({ pago: 1000, valorLiquido: 937 })];
    const r = resumoDesconto(vendas, lotes);
    const taxa = taxaDaSympla(vendas);
    expect(descontoPonderado(r.total)).toBe(0);
    expect(taxa.taxa).toBe(63);
    expect(taxa.percentual).toBeCloseTo(0.063);
  });

  it("separa sorteio, resgate de faturado, credencial e visita avulsa", () => {
    const r = foraDoDesconto([
      { status: "APPROVED", quantity: 2, total_price: 0, coupon_code: "100.00% - GANHADOR_ANITA", ticket_type: "Lote 0 | Padrão" },
      { status: "APPROVED", quantity: 3, total_price: 0, coupon_code: "100.00% - COPAAZUL100", redeems: "D1", ticket_type: "Lote 0 | Padrão" },
      { status: "APPROVED", quantity: 1, total_price: 0, coupon_code: "100.00% - CREDSUM26_PEPE", ticket_type: "Lote 0 | Credencial" },
      { status: "APPROVED", quantity: 3, total_price: 3000, unit_price: 1000, ticket_type: "Lote 0 | Visita (dia 19)" },
    ]);
    expect(r.find((x) => x.id === "cortesias")?.quantidade).toBe(2);
    expect(r.find((x) => x.id === "resgates")?.quantidade).toBe(3);
    expect(r.find((x) => x.id === "gratuitos")?.quantidade).toBe(1);
    expect(r.find((x) => x.id === "visitas")?.quantidade).toBe(3);
  });

  it("alerta o CRM por negócio, sem duplicar duas linhas do mesmo negócio", () => {
    const r = alertasCrmDesconto([
      { source: "pipedrive", status: "APPROVED", deal_id: "D1", ticket_type: "Produto desconhecido", total_price: 100, quantity: 1, sold_at: "2026-11-01" },
      { source: "pipedrive", status: "APPROVED", deal_id: "D1", ticket_type: "Produto desconhecido", total_price: 100, quantity: 1, sold_at: "2026-11-01" },
    ]);
    expect(r).toEqual([{ campo: "Tipo de ingresso ou lote", negocios: 1 }]);
  });
});

describe("ordem comum das listas de lotes", () => {
  const calendario = [
    { name: "Lote 0", start_date: "2026-11-03", end_date: "2026-11-08", sort_order: 0 },
    { name: "Lote 1", start_date: "2026-11-09", end_date: "2026-11-25", sort_order: 1 },
    { name: "Lote 2", start_date: "2026-11-27", end_date: "2026-12-17", sort_order: 2 },
  ];
  it("vigente primeiro e futuro fora até o dia de início", () => {
    expect(lotesParaLista(["Lote 0", "Lote 1", "Lote 2"], "Lote 1", calendario, "2026-11-25")).toEqual(["Lote 1", "Lote 0"]);
    expect(lotesParaLista(["Lote 0", "Lote 1", "Lote 2"], "Lote 2", calendario, "2026-11-27")).toEqual(["Lote 2", "Lote 1", "Lote 0"]);
  });
  it("entre lotes, o próximo continua oculto", () => {
    expect(lotesParaLista(["Lote 0", "Lote 1", "Lote 2"], "Lote 2", calendario, "2026-11-26")).toEqual(["Lote 1", "Lote 0"]);
  });
  it("o planejamento de metas ainda permite escolher lotes futuros", () => {
    expect(lotesParaLista(["Lote 0", "Lote 1", "Lote 2"], "Lote 2", calendario, "2026-11-26", true)).toEqual(["Lote 2", "Lote 1", "Lote 0"]);
  });
});
