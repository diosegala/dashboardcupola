import { describe, expect, it } from "vitest";
import { companyProfiles, countProfiles } from "./companyProfile";

describe("perfil da empresa", () => {
  it("formulário antigo de uma opção", () => {
    expect(companyProfiles("Imobiliária de Venda e Locação")).toEqual(["Aluguel", "Venda de terceiros"]);
    expect(companyProfiles("Imobiliária de Venda")).toEqual(["Venda de terceiros"]);
    expect(companyProfiles("Imobiliária de Locação")).toEqual(["Aluguel"]);
    expect(companyProfiles("Outros")).toEqual(["Outros"]);
  });
  it("formulário novo com várias opções, com e sem acento, e em lista", () => {
    expect(companyProfiles("Imobiliaria Aluguel|Imobiliaria Venda (terceiros)|Imobiliaria Venda (lançamentos)|Corretor de Imóveis")).toEqual([
      "Aluguel", "Venda de terceiros", "Lançamentos", "Corretor de imóveis",
    ]);
    expect(companyProfiles('["Imobiliária Aluguel","Outro"]')).toEqual(["Aluguel", "Outros"]);
    expect(companyProfiles("5")).toEqual([]);
  });
  it("soma os iguais por participante", () => {
    const r = countProfiles(
      [{ p: "Imobiliária Aluguel", q: 2 }, { p: "Imobiliaria Aluguel|Incorporadora", q: 1 }, { p: "Imobiliária de Venda e Locação", q: 1 }],
      (t) => t.p,
      (t) => t.q,
    );
    expect(r).toEqual([{ label: "Aluguel", value: 4 }, { label: "Incorporadora", value: 1 }, { label: "Venda de terceiros", value: 1 }]);
  });
});
