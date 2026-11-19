import { describe, expect, it } from "vitest";
import { combinarColunas, conferir, lerCsv, montarLinhas, papelDaPlanilha, resumo, type Base, type LinhaPlanilha } from "@/lib/userImport";

const EV = "ev-2027";
const base = (): Base => ({
  pessoas: [
    { id: "u-ana", email: "ana.lima@cupola.com.br", name: "Ana Lima", role: "viewer", disabled: false },
    { id: "u-adm", email: "chefe@cupola.com.br", name: "Chefe Admin", role: "admin", disabled: false },
    { id: "u-todos", email: "todos@cupola.com.br", name: "Vê Tudo", role: "viewer", disabled: false },
    { id: "u-inativo", email: "inativo@cupola.com.br", name: "Ina Tivo", role: "viewer", disabled: true },
  ],
  acesso: new Map([
    ["u-ana", { allEvents: false, eventIds: ["ev-2026"] }],
    ["u-todos", { allEvents: true, eventIds: [] }],
  ]),
  fichas: [
    { id: "f-ana", name: "Ana", codes: ["ANA5"], userId: "u-ana" },
    { id: "f-livre", name: "Vivian", codes: ["VIVIAN5"], userId: null },
  ],
  vendasPorCupom: new Map([["ANA5", 12]]),
  eventId: EV,
  adminRole: "admin",
});
const linha = (l: Partial<LinhaPlanilha> & { linha: number }): LinhaPlanilha => ({ first: "", last: "", email: "", role: "", coupons: [], ...l });

describe("combinação de colunas", () => {
  it("combina títulos do modelo, sinônimos e ignora o resto", () => {
    expect(combinarColunas(["Nome*", "SOBRENOME", "Email", "Papel", "Cupom", "Telefone"])).toEqual(["first", "last", "email", "role", "coupons", null]);
  });
});

describe("leitura de CSV", () => {
  it("detecta ponto e vírgula, aspas e BOM", () => {
    const t = lerCsv('﻿Nome;E-mail;Cupons\n"Ana";ana@x.com;"ANA5, ANA10"\n');
    expect(t[1]).toEqual(["Ana", "ana@x.com", "ANA5, ANA10"]);
    const linhas = montarLinhas(t, combinarColunas(t[0]));
    expect(linhas[0].coupons).toEqual(["ANA5", "ANA10"]);
  });
});

describe("função", () => {
  it("aceita só as funções importáveis", () => {
    expect(papelDaPlanilha("visualizador").role).toBe("viewer");
    expect(papelDaPlanilha("Ranking").role).toBe("seller");
    expect(papelDaPlanilha("Administrador").role).toBeNull();
    expect(papelDaPlanilha("").motivo).toMatch(/Informe a função/);
  });
});

describe("conferência", () => {
  it("pessoa nova completa vira convite com o evento", () => {
    const [r] = conferir([linha({ linha: 2, first: "joão", last: "silva", email: " Joao@X.com ", role: "Ranking", coupons: ["JOAO5"] })], base(), {});
    expect(r.situacao).toBe("nova");
    expect(r.pendentes).toHaveLength(0);
    expect(r.plano?.convidar).toEqual({ email: "joao@x.com", name: "João Silva", role: "seller" });
    expect(r.plano?.novosCodigos).toEqual(["JOAO5"]);
    expect(r.plano?.liberarEvento).toBe(true);
  });

  it("pessoa nova sem função ou sobrenome fica pendente até corrigir ou ignorar", () => {
    const l = linha({ linha: 3, first: "Bia", email: "bia@x.com" });
    const [r] = conferir([l], base(), {});
    expect(r.pendentes[0]).toMatchObject({ tipo: "dados", campos: ["last", "role"] });
    const [corrigida] = conferir([l], base(), { 3: { edicao: { last: "Souza", role: "Visualizador" } } });
    expect(corrigida.pendentes).toHaveLength(0);
    const [ignorada] = conferir([l], base(), { 3: { ignorar: true } });
    expect(ignorada.situacao).toBe("ignorada");
  });

  it("administrador nunca é criado pela planilha", () => {
    const [r] = conferir([linha({ linha: 2, first: "A", last: "B", email: "novo@x.com", role: "Administrador" })], base(), {});
    expect(r.pendentes[0]).toMatchObject({ tipo: "dados", campos: ["role"] });
  });

  it("quem já existe não muda papel nem nome, e soma o evento", () => {
    const [r] = conferir([linha({ linha: 2, first: "Outro", last: "Nome", email: "ana.lima@cupola.com.br", role: "Ranking" })], base(), {});
    expect(r.situacao).toBe("existente");
    expect(r.nome).toBe("Ana Lima");
    expect(r.plano?.convidar).toBeUndefined();
    expect(r.plano?.liberarEvento).toBe(true);
  });

  it("administrador e quem vê todos não ganham evento; sem nada novo é sem mudança", () => {
    const rs = conferir([linha({ linha: 2, email: "chefe@cupola.com.br" }), linha({ linha: 3, email: "todos@cupola.com.br" })], base(), {});
    expect(rs.map((r) => r.situacao)).toEqual(["sem_mudanca", "sem_mudanca"]);
  });

  it("administrador que vende ganha o cupom novo sem mudar o papel", () => {
    const [r] = conferir([linha({ linha: 2, email: "chefe@cupola.com.br", coupons: ["CHEFE5"] })], base(), {});
    expect(r.situacao).toBe("existente");
    expect(r.plano?.novosCodigos).toEqual(["CHEFE5"]);
    expect(r.plano?.liberarEvento).toBe(false);
  });

  it("cupom em ficha sem dono liga a ficha, sem duplicar", () => {
    const [r] = conferir([linha({ linha: 2, first: "Vivian", last: "Carvalho", email: "vivian@x.com", role: "Ranking", coupons: ["VIVIAN5"] })], base(), {});
    expect(r.plano?.ligarFichas).toEqual(["f-livre"]);
    expect(r.plano?.novosCodigos).toEqual([]);
  });

  it("cupom de outra pessoa exige decisão e mostra o impacto", () => {
    const l = linha({ linha: 2, first: "Ana", last: "Souza", email: "ana.souza@x.com", role: "Ranking", coupons: ["ANA5"] });
    const [r] = conferir([l], base(), {});
    expect(r.pendentes[0]).toMatchObject({ tipo: "cupom_de_outro", dono: "Ana Lima", vendas: 12, donoFicaSemCupom: true });
    const [manter] = conferir([l], base(), { 2: { cupons: { ANA5: { tipo: "manter" } } } });
    expect(manter.plano?.novosCodigos).toEqual([]);
    expect(manter.plano?.transferencias).toEqual([]);
    const [transf] = conferir([l], base(), { 2: { cupons: { ANA5: { tipo: "transferir" } } } });
    expect(transf.plano?.transferencias[0]).toMatchObject({ codigo: "ANA5", fichaOrigem: "f-ana", vendas: 12 });
    const [outro] = conferir([l], base(), { 2: { cupons: { ANA5: { tipo: "outro", codigo: "anas5" } } } });
    expect(outro.plano?.novosCodigos).toEqual(["ANAS5"]);
  });

  it("pessoa inativa pergunta se reativa", () => {
    const l = linha({ linha: 2, email: "inativo@cupola.com.br" });
    expect(conferir([l], base(), {})[0].pendentes[0]).toEqual({ tipo: "inativo" });
    const [r] = conferir([l], base(), { 2: { reativar: true } });
    expect(r.plano?.reativar).toBe(true);
  });

  it("e-mail repetido vale a primeira linha; exemplos e vazias são ignorados", () => {
    const rs = conferir([
      linha({ linha: 2, first: "A", last: "B", email: "x@x.com", role: "Ranking" }),
      linha({ linha: 3, first: "A", last: "B", email: "X@x.com", role: "Ranking" }),
      linha({ linha: 4, first: "Maria", last: "Exemplo", email: "maria@exemplo.com", role: "Ranking" }),
      linha({ linha: 5 }),
    ], base(), {});
    expect(rs.map((r) => r.situacao)).toEqual(["nova", "repetida", "exemplo", "vazia"]);
    expect(rs[1].repetidaDe).toBe(2);
    expect(resumo(rs)).toMatchObject({ prontas: 1, novas: 1, repetidas: 1, exemplos: 1 });
  });

  it("mesmo cupom em duas linhas: a segunda decide", () => {
    const rs = conferir([
      linha({ linha: 2, first: "A", last: "B", email: "a@x.com", role: "Ranking", coupons: ["NOVO5"] }),
      linha({ linha: 3, first: "C", last: "D", email: "c@x.com", role: "Ranking", coupons: ["NOVO5"] }),
    ], base(), {});
    expect(rs[1].pendentes[0]).toMatchObject({ tipo: "cupom_repetido", linhaOriginal: 2 });
  });
});
