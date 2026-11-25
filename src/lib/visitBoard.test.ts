import { describe, expect, it } from "vitest";
import { chaveFinalidade, montarQuadroVisitas, NAO_INFORMADO } from "./visitBoard";

const P = "Em qual visita presencial no dia 19/05/2027 você prefere participar?";
const form = (v: string) => [{ name: "Empresa", value: "X" }, { name: P, value: v }];

// Base real do Summit 27 em 25/11/2026: 3 avulsas + 6 de combo, 9 respostas.
const vendas = [
  ["a1", "Lote 0 | Padrão + Visita (dias 19, 20 e 21)", "Venda"],
  ["a2", "Lote 0 | Padrão + Visita (dias 19, 20 e 21)", "Venda"],
  ["a3", "Lote 0 | Combo Padrão (dias 19, 20 e 21)", "Venda"],
  ["a4", "Lote 0 | Combo Padrão (dias 19, 20 e 21)", "Venda"],
  ["a5", "Lote 1 | Padrão + Visita (dias 19, 20 e 21)", "Venda"],
  ["a6", "Lote 1 | VIP + Visita (dias 19, 20 e 21)", "Lançamento"],
  ["p1", "Lote 1 | Visita (dia 19)", "Locação"],
  ["p2", "Lote 1 | Visita (dia 19)", "Locação"],
  ["p3", "Lote 1 | Visita (dia 19)", "Venda"],
  ["g1", "Lote 1 | Grupo 2 a 5 Ingressos Padrão", "Venda"],
] as const;
const tickets = vendas.map(([id, tipo], i) => ({
  sympla_order_id: id, ticket_type: tipo, quantity: 1, sold_at: `2026-11-${10 + i}`,
  buyer_name: id.startsWith("p") ? "Pedro  Souza" : `C ${id}`, buyer_email: id.startsWith("p") ? "pedro@x.com" : null, buyer_company: id.startsWith("p") ? "Diferencial Imóveis" : null,
}));
const formularios = new Map(vendas.map(([id, , v]) => [id, form(v)]));

describe("quadro de visitas", () => {
  it("9 visitas: 3 avulsas e 6 de combo, com 9 respostas", () => {
    const q = montarQuadroVisitas(tickets, formularios);
    expect([q.total, q.avulsas, q.combos, q.respondidas]).toEqual([9, 3, 6, 9]);
    expect(q.finalidades.map((f) => [f.rotulo, f.total])).toEqual([["Venda", 6], ["Locação", 2], ["Lançamento", 1]]);
  });

  it("agrupa o comprador avulso com quantidade e finalidades", () => {
    const [p] = montarQuadroVisitas(tickets, formularios).compradores;
    expect(p).toMatchObject({ nome: "Pedro Souza", empresa: "Diferencial Imóveis", quantidade: 3 });
    expect(p.finalidades).toEqual([{ rotulo: "Locação", total: 2 }, { rotulo: "Venda", total: 1 }]);
  });

  it("escritas diferentes da mesma opção viram um grupo, com o rótulo mais recente", () => {
    expect(chaveFinalidade("Visita de locação")).toBe(chaveFinalidade("Locação "));
    const t = [{ ...tickets[6], sold_at: "2026-11-01" }, { ...tickets[7], sold_at: "2026-11-02" }];
    const f = new Map([["p1", form("Visita de locação")], ["p2", form("Locação")]]);
    const [g] = montarQuadroVisitas(t, f).finalidades;
    expect([g.rotulo, g.total, g.escritas]).toEqual(["Locação", 2, ["Visita de locação", "Locação"]]);
  });

  it("parecidas mas não iguais: não agrupa e avisa", () => {
    const f = new Map([["p1", form("Lançamento")], ["p2", form("Lançamentos novos")]]);
    const q = montarQuadroVisitas(tickets.slice(6, 8), f);
    expect(q.finalidades).toHaveLength(2);
    expect(q.parecidas).toHaveLength(1);
  });

  it("faturado do Pipedrive conta na visita e aparece como Não informado", () => {
    const q = montarQuadroVisitas([{ ticket_type: "Combo Padrão", quantity: 2, source: "pipedrive" as const }], new Map());
    expect(q.total).toBe(2);
    expect(q.finalidades[0]).toMatchObject({ rotulo: NAO_INFORMADO, total: 2 });
  });

  it("pergunta renomeada: avisa com as perguntas existentes em vez de zerar", () => {
    const f = new Map([["p1", [{ name: "Qual seu objetivo?", value: "Venda" }]]]);
    const q = montarQuadroVisitas(tickets.slice(6, 7), f);
    expect(q.perguntaNaoEncontrada).toEqual(["Qual seu objetivo?"]);
    expect(q.total).toBe(1);
  });
});
