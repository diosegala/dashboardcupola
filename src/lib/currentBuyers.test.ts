import { describe, expect, it } from "vitest";
import { currentBuyers } from "./currentBuyers";

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
});
