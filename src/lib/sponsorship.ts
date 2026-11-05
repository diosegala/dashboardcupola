// Configuração de patrocínio por evento: tipos, listas fixas da interface e sugestões automáticas.
// Nada aqui é específico de um evento, cota ou funil: tudo o que muda de um evento ou cliente para outro
// vem da tabela sponsorship_config. Os textos de sugestão abaixo são vocabulário genérico do português.

import type { Json } from "@/integrations/supabase/types";

export const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---------- listas fixas da interface ----------
export const STAGE_GROUPS = [
  { key: "lead", label: "Lead" },
  { key: "abordagem", label: "Abordagem" },
  { key: "reuniao", label: "Reunião agendada" },
  { key: "negociacao", label: "Negociação" },
] as const;

export const TEMPERATURES = [
  { key: "frio", label: "Frio" },
  { key: "morno", label: "Morno" },
  { key: "quente", label: "Quente" },
] as const;

export const PIPELINE_KINDS = [
  { key: "cota", label: "Uma cota específica" },
  { key: "varias_cotas", label: "Várias cotas" },
  { key: "outro", label: "Outro tipo (adicionais, mídia, estande)" },
] as const;

export const PRODUCT_CLASSES = [
  { key: "patrocinio", label: "Patrocínio (cota)" },
  { key: "adicional", label: "Adicional" },
  { key: "ingresso", label: "Ingresso (fora da receita de patrocínio)" },
  { key: "ignorar", label: "Ignorar neste evento" },
] as const;

// ---------- tipos da configuração ----------
export interface PipelineLink {
  pipeline_pd_id: number;
  represents: "cota" | "varias_cotas" | "outro";
  quota_key?: string | null;
  // Veio da edição anterior: o admin ainda precisa confirmar.
  suggested?: boolean;
}
export interface Quota {
  key: string;
  name: string;
  order: number;
  list_price: number | null;
  max_slots: number | null;
}
export interface ProductRule {
  product_pd_id: number;
  classification: string;
  quota_key?: string | null;
  variation_as_item?: boolean;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
}
export interface FieldRef {
  object: "deal" | "organization";
  field_key: string;
}
export interface Deliverable {
  key: string;
  name: string;
  days_before_event: number | null;
}

export interface SponsorshipDraft {
  crm_account: string;
  sales_window_start: string;
  sales_window_end: string;
  sales_deadline: string;
  product_term: string;
  // Código do produto no Pipedrive que marca a venda de patrocínio (junto com o termo no nome).
  product_code: string;
  pipelines: PipelineLink[];
  stage_groups: Record<string, string>;
  temperature_labels: Record<string, number[]>;
  quotas: Quota[];
  product_rules: ProductRule[];
  field_mapping: Record<string, FieldRef>;
  deliverables: Deliverable[];
  copied_from_event_id: string | null;
}

export const EMPTY_DRAFT: SponsorshipDraft = {
  crm_account: "",
  sales_window_start: "",
  sales_window_end: "",
  sales_deadline: "",
  product_term: "",
  product_code: "",
  pipelines: [],
  stage_groups: {},
  temperature_labels: {},
  quotas: [],
  product_rules: [],
  field_mapping: {},
  deliverables: [],
  copied_from_event_id: null,
};

const asArray = <T,>(v: Json | undefined): T[] => (Array.isArray(v) ? (v as unknown as T[]) : []);
const asObject = <T,>(v: Json | undefined): Record<string, T> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as unknown as Record<string, T>) : {};

// Linha do banco -> rascunho editável.
export function draftFromRow(row: Record<string, any> | null | undefined): SponsorshipDraft {
  if (!row) return { ...EMPTY_DRAFT };
  return {
    crm_account: row.crm_account ?? "",
    sales_window_start: row.sales_window_start ?? "",
    sales_window_end: row.sales_window_end ?? "",
    sales_deadline: row.sales_deadline ?? "",
    product_term: row.product_term ?? "",
    product_code: row.product_code ?? "",
    pipelines: asArray<PipelineLink>(row.pipelines),
    stage_groups: asObject<string>(row.stage_groups),
    temperature_labels: asObject<number[]>(row.temperature_labels),
    quotas: asArray<Quota>(row.quotas),
    product_rules: asArray<ProductRule>(row.product_rules),
    field_mapping: asObject<FieldRef>(row.field_mapping),
    deliverables: asArray<Deliverable>(row.deliverables),
    copied_from_event_id: row.copied_from_event_id ?? null,
  };
}

// Rascunho -> colunas do banco (texto vazio vira nulo).
export function rowFromDraft(eventId: string, d: SponsorshipDraft, userId: string | null) {
  return {
    event_id: eventId,
    crm_account: d.crm_account.trim().toLowerCase() || null,
    sales_window_start: d.sales_window_start || null,
    sales_window_end: d.sales_window_end || null,
    sales_deadline: d.sales_deadline || null,
    product_term: d.product_term.trim() || null,
    product_code: d.product_code.trim() || null,
    pipelines: d.pipelines as unknown as Json,
    stage_groups: d.stage_groups as unknown as Json,
    temperature_labels: d.temperature_labels as unknown as Json,
    quotas: d.quotas as unknown as Json,
    product_rules: d.product_rules as unknown as Json,
    field_mapping: d.field_mapping as unknown as Json,
    deliverables: d.deliverables as unknown as Json,
    copied_from_event_id: d.copied_from_event_id,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
}

// Copiar de outro evento: leva tudo o que é modelo e deixa de fora o que é desta edição (conta, datas).
// Os funis voltam marcados como sugestão para o admin confirmar.
export function draftFromTemplate(source: SponsorshipDraft, sourceEventId: string, current: SponsorshipDraft): SponsorshipDraft {
  return {
    ...current,
    crm_account: current.crm_account || source.crm_account,
    product_term: source.product_term,
    product_code: source.product_code,
    pipelines: source.pipelines.map((p) => ({ ...p, suggested: true })),
    stage_groups: { ...source.stage_groups },
    temperature_labels: { ...source.temperature_labels },
    quotas: source.quotas.map((q) => ({ ...q })),
    product_rules: source.product_rules.map((r) => ({ ...r })),
    field_mapping: { ...source.field_mapping },
    deliverables: source.deliverables.map((d) => ({ ...d })),
    copied_from_event_id: sourceEventId,
  };
}

// ---------- dados que vêm do list-crm-options ----------
export interface CrmField {
  key: string;
  name: string;
  field_type: string;
  edit_flag?: boolean;
  active_flag?: boolean;
  options?: { id: number | string; label: string }[];
}
export interface CrmOptions {
  pipelines: { id: number; name: string; order_nr?: number; is_deleted?: boolean }[];
  stages: { id: number; pipeline_id: number; name: string; order_nr?: number; deal_probability?: number; days_to_rotten?: number | null }[];
  products: { id: number; name: string; code?: string | null; is_deleted?: boolean; prices?: { price?: number; currency?: string }[] }[];
  variations: { id: number; product_id: number; name: string }[];
  deal_fields: CrmField[];
  organization_fields: CrmField[];
  users: { id: number; name: string; active_flag?: boolean }[];
  account: { domain: string; rate?: { limit?: number; remaining?: number } };
}

export const productMatchesTerm = (p: { name?: string; code?: string | null }, term: string) => {
  const t = norm(term);
  return !!t && (norm(p.name).includes(t) || norm(p.code).includes(t));
};

// Produto que conta como venda do evento: termo no nome e o código configurado (sem código, basta o termo).
export const isEventProduct = (p: { name?: string | null; code?: string | null }, term: string, code: string) => {
  const t = norm(term);
  if (!t || !norm(p.name).includes(t)) return false;
  const c = norm(code);
  return !c || norm(p.code) === c;
};

// Cota do produto pelo nome ("Cota Prata - ..." vira a cota "Prata"). Sem cota pelo nome: null (linha "Outros produtos do evento").
export function quotaOfProduct(name: string | null | undefined, quotas: Quota[]): Quota | null {
  const n = norm(name);
  // Nomes mais longos primeiro, para uma cota não engolir outra de nome parecido.
  const sorted = [...quotas].filter((q) => norm(q.name)).sort((a, b) => norm(b.name).length - norm(a.name).length);
  // Compara palavra por palavra: "Ouro" não casa com "Ouro Branco" se existir cota "Ouro Branco" (vem antes) nem com "Tesouro".
  const words = ` ${n.replace(/[^a-z0-9]+/g, " ").trim()} `;
  return sorted.find((q) => words.includes(` ${norm(q.name).replace(/[^a-z0-9]+/g, " ").trim()} `)) ?? null;
}

// ---------- sugestões ----------
export function suggestStageGroup(name: string): string | null {
  const n = norm(name);
  if (/negocia|proposta|fechamento|contrato|faturamento/.test(n)) return "negociacao";
  if (/reuni|agendad|demonstra/.test(n)) return "reuniao";
  if (/tentativa|contato|abordagem|qualifica|reagend/.test(n)) return "abordagem";
  if (/^lead|^novo/.test(n)) return "lead";
  return null;
}

export function suggestTemperature(label: string): string | null {
  const n = norm(label);
  return TEMPERATURES.find((t) => n.includes(t.key))?.key ?? null;
}

// Cotas a partir dos nomes de produto no formato "Cota <nome> - ...".
export function quotasFromProducts(products: { name: string }[], existing: Quota[]): Quota[] {
  const out = [...existing];
  for (const p of products) {
    const m = /\bcota\s+(.+?)\s*(?:[-–—]|$)/i.exec(p.name);
    const name = m?.[1]?.trim();
    if (!name) continue;
    const key = slug(name);
    if (!key || out.some((q) => q.key === key)) continue;
    out.push({ key, name, order: out.length + 1, list_price: null, max_slots: null });
  }
  return out;
}

export function suggestProductRule(p: { name: string }, quotas: Quota[]): { classification: string; quota_key: string | null } | null {
  const n = norm(p.name);
  if (/\bingresso/.test(n)) return { classification: "ingresso", quota_key: null };
  if (/\badiciona/.test(n)) return { classification: "adicional", quota_key: null };
  const quota = quotas.find((q) => q.name && n.includes(norm(q.name)));
  if (quota) return { classification: "patrocinio", quota_key: quota.key };
  if (/\bcota\b/.test(n)) return { classification: "patrocinio", quota_key: null };
  return null;
}

export const DEFAULT_DELIVERABLES: Deliverable[] = [
  { key: "marca", name: "Marca", days_before_event: null },
  { key: "cupom", name: "Cupom", days_before_event: null },
  { key: "enxoval", name: "Enxoval", days_before_event: null },
  { key: "collab", name: "Collab", days_before_event: null },
  { key: "rodape_site", name: "Rodapé do site", days_before_event: null },
  { key: "header_site", name: "Header do site", days_before_event: null },
  { key: "rodape_emails", name: "Rodapé dos e-mails de marketing", days_before_event: null },
  { key: "estande", name: "Escolha do estande", days_before_event: null },
];

// ---------- mapeamento de campos do CRM ----------
// Cada informação que a página usa, o tipo de campo esperado e as pistas para achar o campo certo:
// pelo nome, pelo tipo e pelas opções.
export interface InfoField {
  key: string;
  label: string;
  object: "deal" | "organization";
  types: string[];
  names: string[];
  options?: string[];
  info: string;
}

export const INFO_FIELDS: InfoField[] = [
  { key: "payment_method", label: "Forma de pagamento", object: "deal", types: ["enum", "set", "varchar"], names: ["forma de pagamento", "meio de pagamento"], options: ["pix", "boleto", "cartao", "permuta"], info: "Boleto, Pix, cartão ou permuta. Permuta conta como cota vendida com R$ 0 e fica fora dos recebimentos." },
  { key: "contract_status", label: "Status do contrato", object: "deal", types: ["enum", "set", "varchar"], names: ["status do contrato", "situacao do contrato"], options: ["assinado", "sem contrato"], info: "Contrato assinado ou sem contrato. Alimenta o alerta de ganho sem contrato." },
  { key: "payment_status", label: "Status do pagamento", object: "deal", types: ["enum", "set", "varchar"], names: ["status do pagamento", "situacao do pagamento"], options: ["pago", "pendente", "atrasado"], info: "Se o patrocinador já pagou. Depois pode vir do financeiro." },
  { key: "signing_date", label: "Data de assinatura", object: "deal", types: ["date"], names: ["data de assinatura", "assinatura"], info: "Dia em que o contrato foi assinado." },
  { key: "sdr", label: "SDR", object: "deal", types: ["user"], names: ["sdr", "pre-vendas", "prospeccao"], info: "Pessoa que prospectou o negócio. Sem SDR aparece como \"Sem SDR\"." },
  { key: "origin", label: "Origem do negócio", object: "deal", types: ["enum", "set", "varchar"], names: ["origem do negocio", "origem", "fonte", "canal"], options: ["inbound", "outbound"], info: "De onde veio o negócio (por exemplo, entrada ou prospecção ativa). Filtro da aba Prospecção." },
  { key: "deliveries", label: "Entregas concluídas", object: "deal", types: ["set"], names: ["entregas concluidas", "entregas"], info: "Campo de múltipla escolha com as contrapartidas já entregues ao patrocinador. Cada opção deve ter o nome de uma entrega da lista do evento." },
  { key: "installments_count", label: "Número de parcelas", object: "deal", types: ["enum", "int", "double", "varchar"], names: ["numero de parcelas", "quantidade de parcelas", "parcelas"], info: "Usado quando o negócio não tem parcelas lançadas no Pipedrive: valor dividido por este número." },
  { key: "first_due_date", label: "1º vencimento", object: "deal", types: ["date"], names: ["primeiro vencimento", "1o vencimento", "data do primeiro pagamento", "vencimento"], info: "Data da primeira parcela, para quando o negócio não tem parcelas lançadas." },
  { key: "brand", label: "Marca", object: "deal", types: ["varchar", "text", "set", "enum"], names: ["marca", "logo", "logotipo"], info: "Marca ou logotipo enviado pelo patrocinador. Entra na lista de entregas." },
  { key: "company_type", label: "Tipo de empresa", object: "organization", types: ["set", "enum", "varchar"], names: ["tipo de empresa", "tipo de organizacao"], info: "Classificação da empresa patrocinadora, com opções fixas." },
  { key: "segment", label: "Segmento ou atuação", object: "organization", types: ["set", "enum", "varchar"], names: ["segmento", "atuacao", "area de atuacao", "trabalha com"], info: "Segmento em que a empresa atua. Filtro da aba Prospecção." },
  { key: "document", label: "CPF ou CNPJ", object: "organization", types: ["varchar"], names: ["cpf/cnpj", "cnpj", "cpf", "documento"], info: "A página mostra só o tipo do documento (CPF ou CNPJ), nunca o número." },
  { key: "site", label: "Site", object: "organization", types: ["varchar", "text"], names: ["site", "website"], info: "Link do site da empresa, no detalhe do patrocinador." },
  { key: "instagram", label: "Instagram", object: "organization", types: ["varchar", "text"], names: ["instagram"], info: "Perfil do Instagram, no detalhe do patrocinador." },
  { key: "linkedin", label: "LinkedIn", object: "organization", types: ["varchar", "text"], names: ["linkedin"], info: "Página no LinkedIn, no detalhe do patrocinador." },
];

const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1);

// Quanto o campo parece responder à informação (0 = não serve).
export function scoreField(info: InfoField, f: CrmField): number {
  if (f.active_flag === false || !info.types.includes(f.field_type)) return 0;
  const name = norm(f.name);
  let score = 0;
  for (const phrase of info.names.map(norm)) {
    if (name === phrase) score = Math.max(score, 10);
    else if (name.includes(phrase)) score = Math.max(score, 6);
    else if (phrase.includes(name) && name.length > 2) score = Math.max(score, 4);
    else {
      const a = tokens(phrase);
      const b = new Set(tokens(name));
      if (a.length && a.filter((t) => b.has(t)).length >= Math.ceil(a.length / 2)) score = Math.max(score, 3);
    }
  }
  if (info.options?.length && f.options?.length) {
    const labels = f.options.map((o) => norm(o.label));
    const hits = info.options.filter((o) => labels.some((l) => l.includes(o))).length;
    if (hits >= 2) score += 6;
    else if (hits === 1) score += 2;
  }
  return score;
}

// Atribuição gulosa: a maior pontuação escolhe primeiro e cada campo serve a uma só informação.
export function suggestFieldMapping(dealFields: CrmField[], orgFields: CrmField[]): Record<string, FieldRef> {
  const pairs: { info: InfoField; field: CrmField; score: number }[] = [];
  for (const info of INFO_FIELDS) {
    for (const field of info.object === "deal" ? dealFields : orgFields) {
      const score = scoreField(info, field);
      if (score >= 4) pairs.push({ info, field, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const result: Record<string, FieldRef> = {};
  const usedFields = new Set<string>();
  for (const { info, field } of pairs) {
    const id = `${info.object}:${field.key}`;
    if (result[info.key] || usedFields.has(id)) continue;
    result[info.key] = { object: info.object, field_key: field.key };
    usedFields.add(id);
  }
  return result;
}

// Informações sem campo correspondente (para avisar e abrir pendência).
export const missingInfoKeys = (mapping: Record<string, FieldRef>) => INFO_FIELDS.filter((i) => !mapping[i.key]?.field_key).map((i) => i.key);

// ---------- textos do "i" ----------
export const SP_INFO = {
  geral: "Só o mínimo para os números aparecerem: conta do Pipedrive, funil, termo e código dos produtos, cotas com preço e lista de entregas. Nenhum nome é fixo no código.",
  conta: "Domínio da conta do Pipedrive deste evento, a parte antes de .pipedrive.com. O token fica na tela Integrações; eventos da CUPOLA usam a conta da CUPOLA e um cliente usa a dele.",
  termo: "Texto que aparece no nome dos produtos do evento no Pipedrive. Produto novo com o termo e o código entra sozinho na receita.",
  codigo: "Código do produto no Pipedrive que marca a venda de patrocínio. Produtos com o termo e outro código (por exemplo, ingressos) ficam fora da receita de patrocínio.",
  funis: "Funil do Pipedrive cujos negócios ganhos entram neste evento. A prospecção usa as etapas do próprio funil, na ordem do Pipedrive.",
  cotas: "Níveis de patrocínio do evento. A cota de cada produto vem do nome (\"Cota Prata - ...\" vira Prata). Produto do evento sem cota pelo nome entra em \"Outros produtos do evento\".",
  cotaNome: "Nome do nível de cota, como aparece no nome do produto no Pipedrive e na página.",
  cotaPreco: "Preço de tabela da cota em reais. O Pipedrive desta conta guarda R$ 0 nos produtos, então o preço vem daqui e mostra o desconto dado.",
  cotaVagas: "Quantidade máxima de patrocinadores nesta cota. Vazio = sem limite.",
  entregas: "Contrapartidas prometidas ao patrocinador. O prazo é em dias antes do evento. O item de chave \"cupom\" se marca sozinho quando o cupom do patrocinador aparece na Sympla.",
  entregaPrazo: "Quantos dias antes do evento a entrega deve estar pronta. Vazio = sem prazo.",
  copiar: "Traz termo, código, cotas e entregas de outro evento como modelo. Os funis voltam como sugestão para você confirmar.",
} as const;
