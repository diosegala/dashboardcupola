import { describe, expect, it } from "vitest";
import { currentBuyers, faturadosDasVendas, invoicedPeople } from "./currentBuyers";

const evento = { slug: "summit-2027", name: "CUPOLA Summit 2027", year: "2027", label: "Summit 2027", endDate: "2027-05-21" };

const row = (id: string, pedido: string, first: string, last: string, buyer = ["Viviane", "Mondardo Pinheiro"], status = "A") => ({
  sympla_order_id: id,
  participant_data: { first_name: first, last_name: last, order_status: status, custom_form: [{ name: "Empresa", value: "Duda Imóveis" }] },
  order_data: { id: pedido, buyer_first_name: buyer[0], buyer_last_name: buyer[1], order_status: status },
});

describe("currentBuyers", () => {
  it("pedido de 8 ingressos ainda sem nomes vira uma linha com 8", () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`t${i}`, "P1", "viviane", "mondardo pinheiro", undefined, "approved"));
    const l = currentBuyers(rows, []);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ ingressos: 8, nominal: false, empresa: "Duda Imóveis" });
  });

  it("pedido com participantes nomeados vira uma linha por pessoa", () => {
    const rows = [row("a", "P2", "Ana", "Silva", undefined, "approved"), row("b", "P2", "Bruno", "Lima", undefined, "approved")];
    const l = currentBuyers(rows, []);
    expect(l.map((x) => x.nome)).toEqual(["Ana Silva", "Bruno Lima"]);
    expect(l.every((x) => x.ingressos === 1 && x.nominal)).toBe(true);
  });

  it("ignora pedidos não aprovados", () => {
    expect(currentBuyers([row("a", "P3", "Ana", "Silva", undefined, "cancelled")], [])).toHaveLength(0);
  });

  it("faturado vira uma linha com a quantidade, descontando os já resgatados", () => {
    const inv = [
      { deal_id: "D1", company: "Acme", quantity: 3, status: "approved" },
      { deal_id: "D1", company: "Acme", quantity: 2, status: "approved" },
      { deal_id: "D2", company: "Aberto", quantity: 4, status: "crm_open" },
    ];
    const l = currentBuyers([], inv, { D1: 1 });
    expect(l).toEqual([expect.objectContaining({ nome: "Acme", ingressos: 4, origem: "Faturado" })]);
  });

  it("faturado mostra no cupom o primeiro nome de quem vendeu", () => {
    const l = currentBuyers([], [{ deal_id: "D1", company: "Gt Building", quantity: 10, status: "approved", seller_name: "Isabelle" }]);
    expect(l[0].cupom).toBe("Isabelle");
  });

  it("faturado vira uma linha de empresa na lista de pessoas, com quem vendeu", () => {
    const inv = [
      { deal_id: "D1", company: "Gt Building", quantity: 6, status: "approved", seller_name: "Suellen" },
      { deal_id: "D1", company: "Gt Building", quantity: 4, status: "approved", seller_name: "Suellen" },
      { deal_id: "D2", company: "Aberto", quantity: 4, status: "crm_open" },
    ];
    const p = invoicedPeople(inv, { D1: 2 }, evento);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: "Gt Building", companies: ["Gt Building"], invoiced: { seller: "Suellen", tickets: 8 } });
    expect(p[0].events["summit-2027"].tickets).toBe(8);
  });

  it("faturado resgatado por inteiro na Sympla não entra na lista de pessoas", () => {
    expect(invoicedPeople([{ deal_id: "D1", company: "Acme", quantity: 3, status: "approved" }], { D1: 3 }, evento)).toHaveLength(0);
  });

  it("faturadosDasVendas separa os faturados, mantém quem vendeu e conta os resgatados", () => {
    const { faturados, resgatados } = faturadosDasVendas([
      { source: "pipedrive", deal_id: "D1", quantity: 10, status: "approved", seller: "Venda interna - Suelen", seller_name: "Suelen" },
      { source: "sympla", quantity: 1, status: "approved", redeems: "D1" },
      { source: "sympla", quantity: 1, status: "approved" },
    ]);
    expect(faturados).toHaveLength(1);
    expect(faturados[0].seller_name).toBe("Suelen");
    expect(resgatados).toEqual({ D1: 1 });
  });
});
