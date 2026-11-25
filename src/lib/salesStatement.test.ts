import { describe, expect, it } from "vitest";
import { agruparVendas, motivoDoStatus, nomeDoPagamento, vendasDoExtrato, type Venda } from "./salesStatement";

describe("extrato de vendas", () => {
  const sympla = (extra: object) => ({ source: "sympla", quantity: 1, status: "approved", sold_at: "2026-11-07T10:20:24Z", ...extra }) as never;
  const vendas = agruparVendas(
    [
      sympla({ order_id: "35EA3BUMQ1S", ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", total_price: 833.93, buyer_name: "Comprador A" }),
      sympla({ order_id: "35EA3BUMQ1S", ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", total_price: 833.93, buyer_name: "Comprador A" }),
      sympla({ order_id: "35EA3BTU1UD", ticket_type: "Lote 0 | Ingresso VIP (dias 20 e 21)", total_price: 1859.52, sold_at: "2026-11-03T17:36:00Z" }),
      { source: "pipedrive", quantity: 21, total_price: 16779, status: "approved", deal_id: "38040", crm_account: "cupola", company: "Pantera Imóveis", ticket_type: "Lote 0 | Grupo de Ingressos Padrão", sold_at: "2026-11-05T12:00:00Z" } as never,
    ],
    [],
  );

  it("uma linha por pedido ou negócio, com os ingressos somados", () => {
    expect(vendas.map((v) => [v.codigo, v.quantidade, v.ingressos, v.valor])).toEqual([
      ["35EA3BUMQ1S", 2, "2 Grupo", 1667.86],
      ["38040", 21, "21 Grupo", 16779],
      ["35EA3BTU1UD", 1, "1 VIP", 1859.52],
    ]);
  });

  it("faturado mostra a empresa e o link do negócio; Sympla, o comprador e o pedido", () => {
    expect(vendas[1]).toMatchObject({ faturado: true, cliente: "Pantera Imóveis", linkNegocio: "https://cupola.pipedrive.com/deal/38040", lote: "Lote 0" });
    expect(vendas[0]).toMatchObject({ faturado: false, cliente: "Comprador A", linkNegocio: null, tiposCompletos: ["10% OFF - 2 a 5 - Padrão"] });
  });
});

describe("etiqueta de status no extrato", () => {
  it("aprovada sem etiqueta; cancelada, estornada e pendente sinalizadas e fora dos totais", async () => {
    const { vendasDoExtrato, statusDaVenda } = await import("./salesStatement");
    expect([statusDaVenda("APPROVED"), statusDaVenda("CANCELLED"), statusDaVenda("R"), statusDaVenda("PENDING"), statusDaVenda("UNPAID")]).toEqual([null, "Cancelado", "Estornado", "Pendente", "Não pago"]);
    const paga = { source: "sympla", quantity: 1, status: "APPROVED", order_id: "OK", total_price: 900, ticket_type: "Lote 0 | Padrão", sold_at: "2026-11-05T12:00:00Z" } as never;
    const cancelada = { source: "sympla", quantity: 2, status: "CANCELLED", order_id: "35EA3BTT4Q7", total_price: 834, ticket_type: "Lote 0 | 10% OFF - 2 a 5 - Padrão", sold_at: "2026-11-03T15:43:05Z" } as never;
    const pendente = { order_data: { id: "35EA3BUVAH5", order_status: "PENDING", order_date: "2026-11-08 22:46:03", order_total_net_value: 1853.38 } };
    const cancelarSemIngresso = { order_data: { id: "X", order_status: "CANCELLED" } };
    const v = vendasDoExtrato([paga], [paga, cancelada], [pendente, cancelarSemIngresso], [], new Date("2026-11-10T12:00:00Z").getTime());
    expect(v.map((x) => [x.codigo, x.status])).toEqual([["35EA3BUVAH5", "Pendente"], ["OK", null], ["35EA3BTT4Q7", "Cancelado"]]);
  });
});

describe("motivo do status explicado na etiqueta", () => {
  const agora = new Date("2026-11-10T12:00:00Z").getTime();
  const venda = (extra: object) =>
    ({ chave: "k", status: null, faturado: false, data: null, lote: "Lote 1", cliente: "X", ingressos: "", quantidade: 0, valor: 0, codigo: null, linkNegocio: null, tiposCompletos: [], cupom: null, canal: "—", link: null, vendedor: null, pagamento: null, texto: "", ...extra }) as Venda;

  it("venda aprovada não tem motivo", () => {
    expect(motivoDoStatus(venda({ status: null }), agora)).toBe("");
  });

  it("pendente por boleto: prazo de compensação, tempo de espera e a regra dos 7 dias", () => {
    const m = motivoDoStatus(venda({ status: "Pendente", pagamento: "Boleto", data: "2026-11-08T12:00:00Z" }), agora);
    expect(m).toContain("Aguardando pagamento por boleto.");
    expect(m).toContain("O boleto demora até 3 dias úteis para compensar depois de pago.");
    expect(m).toContain("Está aguardando há 2 dias.");
    expect(m).toContain("Ainda não conta como venda.");
    expect(m).toContain("Se passar de 7 dias sem aprovar, vira cancelado.");
  });

  it("pendente por Pix explica que o Pix aprova em minutos", () => {
    const m = motivoDoStatus(venda({ status: "Pendente", pagamento: "Pix", data: "2026-11-09T12:00:00Z" }), agora);
    expect(m).toContain("O Pix costuma aprovar em minutos");
    expect(m).toContain("Está aguardando há 1 dia.");
  });

  it("pendente por cartão fala das compras retidas", () => {
    const m = motivoDoStatus(venda({ status: "Pendente", pagamento: "Cartão de crédito", data: "2026-11-09T12:00:00Z" }), agora);
    expect(m).toContain("A maioria dos cartões aprova na hora; compras retidas podem levar até 72 horas.");
  });

  it("menos de um dia de espera não fala em quantos dias", () => {
    const m = motivoDoStatus(venda({ status: "Pendente", pagamento: "Pix", data: "2026-11-10T11:00:00Z" }), agora);
    expect(m).not.toContain("Está aguardando há");
  });

  it("cancelado porque expirou no painel diz os 7 dias", () => {
    const m = motivoDoStatus(venda({ status: "Cancelado", expirado: true, data: "2026-11-01T12:00:00Z" }), agora);
    expect(m).toBe("Cancelado aqui no painel: ficou mais de 7 dias aguardando pagamento sem aprovar. Não conta na receita.");
  });

  it("cancelado pela Sympla não fala em prazo do painel", () => {
    const m = motivoDoStatus(venda({ status: "Cancelado", data: "2026-11-05T12:00:00Z" }), agora);
    expect(m).toBe("Cancelado na Sympla: o comprador desistiu ou o pagamento não foi aprovado. Não conta na receita.");
  });

  it("estornado e não pago explicam o que aconteceu com o dinheiro", () => {
    expect(motivoDoStatus(venda({ status: "Estornado" }), agora)).toBe("Estornado na Sympla: o valor pago foi devolvido ao comprador. Não conta na receita.");
    expect(motivoDoStatus(venda({ status: "Não pago" }), agora)).toBe("Não pago: o pedido foi criado, mas o pagamento não entrou. Não conta na receita.");
  });

  it("status inesperado manda conferir na Sympla", () => {
    expect(motivoDoStatus(venda({ status: "Verificar" }), agora)).toBe("Status diferente do esperado na Sympla: confirme o pedido na Sympla. Não conta na receita.");
  });

  it("traduz o nome do pagamento que a Sympla manda", () => {
    expect([nomeDoPagamento("boleto_bancario"), nomeDoPagamento("PIX"), nomeDoPagamento("credit_card"), nomeDoPagamento("debit_card"), nomeDoPagamento(null)]).toEqual([
      "Boleto", "Pix", "Cartão de crédito", "Cartão de débito", null,
    ]);
  });

  it("pedido aguardando com boleto_bancario explica o boleto em português", () => {
    const agora = new Date("2026-11-10T12:00:00Z").getTime();
    const v = vendasDoExtrato([], [], [{ order_data: { id: "P1", order_status: "PENDING", order_date: "2026-11-08 10:00:00", order_total_net_value: 1975, transaction_type: "boleto_bancario" } }], [], agora);
    expect(v[0].pagamento).toBe("Boleto");
    expect(motivoDoStatus(v[0], agora)).toContain("Aguardando pagamento por boleto.");
    expect(motivoDoStatus(v[0], agora)).not.toContain("boleto_bancario");
  });
});

describe("visita avulsa no extrato", () => {
  it("aparece com valor e 0 participante", () => {
    const [v] = agruparVendas([{ sympla_order_id: "1", order_id: "P1", ticket_type: "Lote 1 | Visita (dia 19)", quantity: 3, total_price: 6181.38, status: "APPROVED", sold_at: "2026-11-24T12:14:09Z" } as any], []);
    expect(v.quantidade).toBe(0);
    expect(v.valor).toBe(6181.38);
    expect(v.ingressos).toContain("Visita avulsa");
  });
});
