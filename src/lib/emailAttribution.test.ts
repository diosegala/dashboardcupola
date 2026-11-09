import { describe, expect, it } from "vitest";
import { linkSales, nomeParecido, type EmailRef } from "./emailAttribution";

const emails: EmailRef[] = [
  { id: "1", name: "[SUM27] LOTE ZERO: Vendas abertas!", sentAt: "2026-11-03T10:00:00Z" },
  { id: "2", name: "[SUM27] Segredos da curadoria do CUPOLA Summit (ass. Kariny)", sentAt: "2026-11-05T11:00:00Z" },
  { id: "3", name: "[SUM27] MOFU | 6 horas para garantir", sentAt: "2026-11-08T10:00:00Z" },
  { id: "4", name: "sum27-ultimo-aviso Último aviso", sentAt: "2026-11-07T10:00:00Z" },
  { id: "5", name: "[SUM27] Vendas abertas – reenvio", sentAt: "2026-11-06T10:00:00Z" },
];
const venda = (id: string, utm: string | null, soldAt: string) => ({ id, utmContent: utm, soldAt });

describe("ligação venda → e-mail", () => {
  it("código exato no começo do nome é exata", () => {
    const [l] = linkSales([venda("a", "sum27-ultimo-aviso", "2026-11-07T12:00:00Z")], emails);
    expect(l).toMatchObject({ emailId: "4", level: "exata" });
  });
  it("nome parecido e horário compatível é confiável", () => {
    const [l] = linkSales([venda("a", "segredo-curadoria", "2026-11-06T15:59:00Z")], emails);
    expect(l).toMatchObject({ emailId: "2", level: "confiavel" });
  });
  it("só nome parecido (venda muito depois) é provável", () => {
    const [l] = linkSales([venda("a", "segredo-curadoria", "2026-11-20T10:00:00Z")], emails);
    expect(l).toMatchObject({ emailId: "2", level: "provavel" });
  });
  it("só horário nunca liga sozinho: vira sugestão para o admin", () => {
    const [l] = linkSales([venda("a", "6h-para-garantir", "2026-11-08T12:00:00Z")], emails);
    expect(l.level).toBe("sugestao");
    expect(l.emailId).toBe("3");
  });
  it("admin confirma a sugestão e ela vira confiável", () => {
    const [l] = linkSales([venda("a", "6h-para-garantir", "2026-11-08T12:00:00Z")], emails, [{ utm_content: "6h-para-garantir", rd_campaign_id: "3" }]);
    expect(l).toMatchObject({ emailId: "3", level: "confiavel", decidido: true });
  });
  it("decisão do admin de não ligar prevalece", () => {
    const [l] = linkSales([venda("a", "segredo-curadoria", "2026-11-06T15:59:00Z")], emails, [{ utm_content: "segredo-curadoria", rd_campaign_id: null }]);
    expect(l.level).toBe("sem");
  });
  it("vários nomes compatíveis: cada venda vai para o compatível mais perto e antes dela", () => {
    const ls = linkSales([venda("a", "vendas-abertas", "2026-11-03T16:00:00Z"), venda("b", "vendas-abertas", "2026-11-06T18:00:00Z")], emails);
    expect(ls.map((l) => l.emailId)).toEqual(["1", "5"]);
  });
  it("sem utm_content não liga", () => {
    expect(linkSales([venda("a", null, "2026-11-03T16:00:00Z")], emails)[0].level).toBe("sem");
  });
  it("ignora maiúsculas, acentos, hífens e palavras pequenas", () => {
    expect(nomeParecido("ingresso-esta-pendente", "[SUM27] MOFU | seu ingresso está pendente")).toBe(true);
    expect(nomeParecido("vendas-abertas", "[SUM27] Segredos da curadoria")).toBe(false);
  });
});

describe("resumo e avisos", () => {
  it("selos + sem ligação somam o canal e geram os três avisos", async () => {
    const { summarizeEmailSales } = await import("./emailAttribution");
    const sales = [
      { id: "a", utmContent: "vendas-abertas", soldAt: "2026-11-03T16:00:00Z", quantidade: 2, valor: 1600 },
      { id: "b", utmContent: "vendas-abertas", soldAt: "2026-11-06T18:00:00Z", quantidade: 1, valor: 800 },
      { id: "c", utmContent: "6h-para-garantir", soldAt: "2026-11-08T12:00:00Z", quantidade: 1, valor: 900 },
      { id: "d", utmContent: "lista_de_espera", soldAt: "2026-11-04T12:00:00Z", quantidade: 3, valor: 2700 },
      { id: "e", utmContent: null, soldAt: "2026-11-04T12:00:00Z", quantidade: 1, valor: 900 },
    ];
    const links = linkSales(sales, emails, [{ utm_content: "lista_de_espera", rd_campaign_id: null }]);
    const r = summarizeEmailSales(sales, links);
    const comSelo = [...r.porEmail.values()].reduce((t, b) => t + b.ingressos, 0);
    expect(comSelo + r.semLigacao).toBe(8);
    expect(r.porEmail.get("1")?.ingressos).toBe(2);
    expect(r.semLigacao).toBe(5);
    expect(r.avisos.map((a) => `${a.tipo}:${a.utmContent}:${a.ingressos}`).sort()).toEqual([
      "sem_email:lista_de_espera:3",
      "so_horario:6h-para-garantir:1",
      "varios_emails:vendas-abertas:3",
    ]);
  });
});
