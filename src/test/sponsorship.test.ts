import { describe, expect, it } from "vitest";
import {
  INFO_FIELDS,
  draftFromTemplate,
  missingInfoKeys,
  quotasFromProducts,
  suggestFieldMapping,
  suggestProductRule,
  suggestStageGroup,
  suggestTemperature,
  EMPTY_DRAFT,
  type CrmField,
} from "@/lib/sponsorship";

const opt = (...labels: string[]) => labels.map((label, id) => ({ id, label }));

// Campos como aparecem no diagnóstico de uma conta real (só a estrutura, sem dado de ninguém).
const dealFields: CrmField[] = [
  { key: "a1", name: "Tipo de negócio", field_type: "enum", edit_flag: true, options: opt("Outbound", "Inbound") },
  { key: "a2", name: "Forma de pagamento", field_type: "enum", edit_flag: true, options: opt("PIX", "Cartão de crédito", "Boleto", "Bonificação / Permuta") },
  { key: "a3", name: "Número de parcelas", field_type: "enum", edit_flag: true, options: opt("01", "02", "03") },
  { key: "a4", name: "Desafio", field_type: "text", edit_flag: true },
  { key: "a5", name: "Mídia", field_type: "varchar", edit_flag: true },
  { key: "a6", name: "Status do diagnóstico", field_type: "enum", edit_flag: true, options: opt("Iniciado", "Concluído") },
];
const orgFields: CrmField[] = [
  { key: "o1", name: "Tipo de empresa", field_type: "set", edit_flag: true, options: opt("Imobiliária", "Proptech") },
  { key: "o2", name: "Trabalha com", field_type: "set", edit_flag: true, options: opt("Marketing Digital") },
  { key: "o3", name: "Site", field_type: "varchar", edit_flag: true },
  { key: "o4", name: "CPF/CNPJ", field_type: "varchar", edit_flag: true },
  { key: "o5", name: "Perfil do Instagram", field_type: "varchar", edit_flag: true },
  { key: "o6", name: "Perfil do Facebook", field_type: "varchar", edit_flag: true },
];

describe("mapeamento de campos do CRM", () => {
  const map = suggestFieldMapping(dealFields, orgFields);

  it("acha o campo pelo nome, pelo tipo e pelas opções", () => {
    expect(map.payment_method?.field_key).toBe("a2");
    expect(map.installments_count?.field_key).toBe("a3");
    expect(map.company_type?.field_key).toBe("o1");
    expect(map.site?.field_key).toBe("o3");
    expect(map.document?.field_key).toBe("o4");
    expect(map.instagram?.field_key).toBe("o5");
  });

  it("acha a origem só pelas opções (Inbound e Outbound), mesmo com outro nome", () => {
    expect(map.origin?.field_key).toBe("a1");
  });

  it("um campo serve a uma informação só: Forma de pagamento não vira Status do pagamento", () => {
    expect(map.payment_status).toBeUndefined();
    expect(new Set(Object.values(map).map((r) => `${r.object}:${r.field_key}`)).size).toBe(Object.keys(map).length);
  });

  it("lista o que não encontrou", () => {
    const missing = missingInfoKeys(map);
    for (const k of ["contract_status", "payment_status", "signing_date", "sdr", "deliveries", "first_due_date", "linkedin"]) expect(missing).toContain(k);
    expect(missing).not.toContain("payment_method");
  });

  it("ignora perguntas de formulário: pergunta que cita marca não vira o campo Marca", () => {
    const m = suggestFieldMapping([{ key: "q1", name: "O empreendimento já tem nome, marca ou book?", field_type: "text", edit_flag: true }], []);
    expect(m.brand).toBeUndefined();
    expect(suggestFieldMapping([{ key: "t1", name: "Tipo", field_type: "varchar", edit_flag: true }], []).brand).toBeUndefined();
  });

  it("respeita o tipo: campo de texto não vira SDR nem data", () => {
    const m = suggestFieldMapping([{ key: "x", name: "SDR responsável", field_type: "varchar", edit_flag: true }], []);
    expect(m.sdr).toBeUndefined();
  });

  it("todas as informações do catálogo têm texto do i", () => {
    for (const i of INFO_FIELDS) expect(i.info.length).toBeGreaterThan(10);
  });
});

describe("sugestões de configuração", () => {
  it("agrupa as etapas pelo nome", () => {
    const by = (n: string) => suggestStageGroup(n);
    expect(by("Lead")).toBe("lead");
    expect(by("Tentativa de contato")).toBe("abordagem");
    expect(by("Contato estabelecido")).toBe("abordagem");
    expect(by("Reagendamento")).toBe("abordagem");
    expect(by("Reunião")).toBe("reuniao");
    expect(by("Negociação ")).toBe("negociacao");
    expect(by("Fechamento")).toBe("negociacao");
    expect(by("Outra coisa")).toBeNull();
  });

  it("reconhece a temperatura pela etiqueta", () => {
    expect(suggestTemperature("Quente")).toBe("quente");
    expect(suggestTemperature("Lead FRIO")).toBe("frio");
    expect(suggestTemperature("Continuados")).toBeNull();
  });

  it("cria as cotas a partir dos nomes de produto", () => {
    const quotas = quotasFromProducts(
      [{ name: "Cota Prata - Summit" }, { name: "Cota Apoiador - CUPOLA Summit" }, { name: "Adicionais - Summit" }, { name: "Cota Prata - Summit" }],
      [],
    );
    expect(quotas.map((q) => q.name)).toEqual(["Prata", "Apoiador"]);
    expect(quotas.map((q) => q.key)).toEqual(["prata", "apoiador"]);
  });

  it("sugere a classificação do produto", () => {
    const quotas = quotasFromProducts([{ name: "Cota Prata - Summit" }], []);
    expect(suggestProductRule({ name: "Cota Prata - Summit" }, quotas)).toEqual({ classification: "patrocinio", quota_key: "prata" });
    expect(suggestProductRule({ name: "Cota Nova - Summit" }, quotas)).toEqual({ classification: "patrocinio", quota_key: null });
    expect(suggestProductRule({ name: "Adicionais - Summit" }, quotas)?.classification).toBe("adicional");
    expect(suggestProductRule({ name: "Ingressos Summit - VIP" }, quotas)?.classification).toBe("ingresso");
    expect(suggestProductRule({ name: "Camiseta" }, quotas)).toBeNull();
  });

  it("copiar de outro evento leva o modelo, deixa as datas e marca os funis como sugestão", () => {
    const source = { ...EMPTY_DRAFT, crm_account: "conta", product_term: "Termo", sales_window_start: "2025-01-01", pipelines: [{ pipeline_pd_id: 13, represents: "varias_cotas" as const }], deliverables: [{ key: "marca", name: "Marca", days_before_event: 30 }] };
    const copy = draftFromTemplate(source, "evento-a", { ...EMPTY_DRAFT, sales_window_start: "2026-03-01" });
    expect(copy.sales_window_start).toBe("2026-03-01");
    expect(copy.product_term).toBe("Termo");
    expect(copy.pipelines[0].suggested).toBe(true);
    expect(copy.deliverables).toHaveLength(1);
    expect(copy.copied_from_event_id).toBe("evento-a");
  });
});
