// Cálculos dos cards Prospecção, Renovação, Recebimentos, Entregas e Adicionais, e a situação de cada campo do CRM.
// Nada aqui conhece nomes de evento, cota, funil ou campo: tudo vem da configuração e da leitura da conta.

import { INFO_FIELDS, isEventProduct, norm, quotaOfProduct, suggestTemperature, type FieldRef, type SponsorshipDraft } from "@/lib/sponsorship";
import { addDays, inEdition, saoPauloDate, type CatalogRow, type DealProductRow, type DealRow, type SponsorshipMetrics } from "@/lib/sponsorshipMetrics";

// ---------- valores dos campos personalizados ----------
export interface OrgRow {
  pd_id: number;
  name: string | null;
  custom_fields: Record<string, unknown> | null;
}
export interface UserRow {
  pd_id: number;
  name: string | null;
}

const filled = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);

export function rawField(ref: FieldRef | undefined, deal: DealRow | undefined, org: OrgRow | undefined): unknown {
  if (!ref) return undefined;
  const src = ref.object === "deal" ? deal?.custom_fields : org?.custom_fields;
  return src ? (src as Record<string, unknown>)[ref.field_key] : undefined;
}

const ddmmyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

// Valor legível de um campo: opção pelo rótulo, usuário pelo nome, data no formato do painel.
export function fieldText(ref: FieldRef | undefined, raw: unknown, users: Map<number, string>): string | null {
  if (!ref || !filled(raw)) return null;
  const opt = (id: unknown) => ref.options?.find((o) => String(o.id) === String(id))?.label ?? String(id);
  const scalar = (v: unknown): unknown => (v && typeof v === "object" && !Array.isArray(v) ? ((v as any).value ?? (v as any).id ?? (v as any).name ?? null) : v);
  const v = scalar(raw);
  switch (ref.field_type) {
    case "enum":
      return opt(v);
    case "set":
      return (Array.isArray(raw) ? raw : String(v).split(",")).map((x) => opt(scalar(x))).join(", ");
    case "user":
      return users.get(Number(v)) ?? String(v);
    case "date":
      return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? ddmmyy(String(v)) : String(v);
    default:
      return String(v);
  }
}

// Labels de um campo de múltipla escolha (para Entregas).
export function setLabels(ref: FieldRef | undefined, raw: unknown): string[] {
  if (!ref || !filled(raw)) return [];
  const ids = Array.isArray(raw) ? raw : String(raw).split(",");
  return ids.map((id) => {
    const v = id && typeof id === "object" ? (id as any).id ?? (id as any).value : id;
    return ref.options?.find((o) => String(o.id) === String(v).trim())?.label ?? String(v);
  });
}

// CPF ou CNPJ: a página mostra só o tipo, nunca o número.
export const documentType = (raw: unknown) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 14 ? "CNPJ" : digits.length === 11 ? "CPF" : digits ? "Outro" : null;
};

// ---------- situação de cada campo ----------
export type FieldState = "nao_lida" | "nao_existe" | "vazio" | "parcial" | "ok";
export interface FieldStatus {
  key: string;
  label: string;
  state: FieldState;
  preenchidos: number;
  total: number;
  nome: string | null;
}

// Para cada informação: o campo existe na conta? Se existe, em quantos negócios ganhos da edição está preenchido?
export function fieldStatuses(config: SponsorshipDraft, wonDeals: DealRow[], orgs: Map<number, OrgRow>): FieldStatus[] {
  return INFO_FIELDS.map((i) => {
    const ref = config.field_mapping[i.key];
    const base = { key: i.key, label: i.label, nome: ref?.name ?? null };
    if (!config.crm_read.read_at) return { ...base, state: "nao_lida" as const, preenchidos: 0, total: wonDeals.length };
    if (!ref) return { ...base, state: "nao_existe" as const, preenchidos: 0, total: wonDeals.length };
    const preenchidos = wonDeals.filter((d) => filled(rawField(ref, d, d.org_pd_id != null ? orgs.get(d.org_pd_id) : undefined))).length;
    const state: FieldState = !wonDeals.length ? "ok" : preenchidos === 0 ? "vazio" : preenchidos < wonDeals.length ? "parcial" : "ok";
    return { ...base, state, preenchidos, total: wonDeals.length };
  });
}

// ---------- negócios do evento num funil compartilhado ----------
// O mesmo funil pode ter negócios de vários eventos. Pertence ao evento o negócio com produto do evento;
// o negócio ainda sem nenhum produto também entra (aberto ou perdido), pelo valor do negócio.
// Negócio só com produtos de outros eventos fica fora. "code" vazio = basta o termo no nome (edição anterior).
export function eventShare(
  config: SponsorshipDraft,
  lines: DealProductRow[],
  catalog: CatalogRow[],
  code: string = config.product_code,
): (d: DealRow) => { doEvento: boolean; valor: number; comProduto: boolean } {
  const byId = new Map(catalog.filter((c) => (c.kind ?? "product") === "product").map((c) => [c.pd_id, c]));
  const porNegocio = new Map<string, DealProductRow[]>();
  for (const l of lines) if (l.is_enabled) porNegocio.set(l.deal_id, [...(porNegocio.get(l.deal_id) ?? []), l]);
  return (d) => {
    const todas = porNegocio.get(d.id) ?? [];
    const doEvento = todas.filter((l) => isEventProduct({ name: byId.get(l.product_pd_id ?? -1)?.name ?? l.name, code: byId.get(l.product_pd_id ?? -1)?.code ?? null }, config.product_term, code));
    if (doEvento.length) return { doEvento: true, valor: doEvento.reduce((t, l) => t + (Number(l.sum) || 0), 0), comProduto: true };
    const semProduto = !todas.length && !(Number(d.products_count) > 0);
    return { doEvento: semProduto, valor: semProduto ? Number(d.value) || 0 : 0, comProduto: false };
  };
}

// ---------- prospecção ----------
export interface StageRow {
  pd_id: number;
  pipeline_pd_id: number;
  name: string;
  order_nr: number | null;
  days_to_rotten: number | null;
}

export interface ProspectStage {
  id: number;
  nome: string;
  abertos: number;
  valor: number;
  chegaram: number;
  // Perdidos que pararam nesta etapa (separados de quem seguiu).
  perdidosAqui: number;
  medianaDias: number | null;
  limiteDias: number;
  travada: boolean;
}

export interface Prospect {
  abordadas: number;
  emNegociacao: number;
  ganhos: number;
  perdidos: number;
  quentes: number | null; // null = a conta não tem etiqueta de temperatura
  valorAberto: number;
  conversao: number | null;
  etapas: ProspectStage[];
  motivos: { motivo: string; negocios: number }[];
  perdidosSemMotivo: number;
  responsaveis: string[];
  // Negócios por canal de origem (null = sem canal no Pipedrive). Vazio quando a conta não tem o campo.
  canais: { canal: string | null; negocios: number; ganhos: number; abertos: number }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Negócios da edição no funil: abertos agora, mais ganhos e perdidos na janela da edição.
export function prospecting(
  config: SponsorshipDraft,
  deals: DealRow[],
  stages: StageRow[],
  window: { previousEnd: string | null; eventEnd: string },
  hoje: string,
  responsavel: string | null,
  share: (d: DealRow) => { doEvento: boolean; valor: number; comProduto: boolean } = (d) => ({ doEvento: true, valor: Number(d.value) || 0, comProduto: true }),
  canalOf?: (d: DealRow) => string | null,
): Prospect {
  const pipes = new Set(config.pipelines.map((p) => p.pipeline_pd_id));
  // Ganho só conta com produto do evento (ganho sem produto fica no aviso de Vendas).
  const naEdicao = (d: DealRow) =>
    d.status === "open" ||
    (d.status === "won" && inEdition(d.won_at, window.previousEnd, window.eventEnd) && share(d).comProduto) ||
    (d.status === "lost" && inEdition(d.lost_at ?? null, window.previousEnd, window.eventEnd));
  const todos = deals.filter((d) => !d.is_deleted && d.pipeline_pd_id != null && pipes.has(d.pipeline_pd_id) && share(d).doEvento && naEdicao(d));
  const responsaveis = [...new Set(todos.map((d) => d.owner_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lista = responsavel ? todos.filter((d) => d.owner_name === responsavel) : todos;

  const etapasFunil = stages
    .filter((s) => pipes.has(s.pipeline_pd_id))
    .sort((a, b) => a.pipeline_pd_id - b.pipeline_pd_id || (a.order_nr ?? 0) - (b.order_nr ?? 0));
  const posicao = new Map(etapasFunil.map((s, i) => [String(s.pd_id), i]));
  const hojeMs = Date.parse(`${hoje}T12:00:00Z`);

  const etapas: ProspectStage[] = etapasFunil.map((s, i) => {
    const abertos = lista.filter((d) => d.status === "open" && d.stage_id === String(s.pd_id));
    const dias = abertos.map((d) => (d.stage_changed_at ?? d.created_at_source ? Math.max(0, Math.round((hojeMs - Date.parse(String(d.stage_changed_at ?? d.created_at_source))) / 86400000)) : null)).filter((x): x is number => x != null);
    const limiteDias = s.days_to_rotten && s.days_to_rotten > 0 ? s.days_to_rotten : 14;
    const mediana = median(dias);
    return {
      id: s.pd_id,
      nome: s.name,
      abertos: abertos.length,
      valor: abertos.reduce((t, d) => t + share(d).valor, 0),
      // Chegaram até a etapa: estão nela ou depois dela (perdidos contam até a etapa em que pararam; ganhos passaram por todas).
      chegaram: lista.filter((d) => d.status === "won" || (posicao.get(String(d.stage_id)) ?? -1) >= i).length,
      perdidosAqui: lista.filter((d) => d.status === "lost" && d.stage_id === String(s.pd_id)).length,
      medianaDias: mediana,
      limiteDias,
      travada: mediana != null && mediana > limiteDias,
    };
  });

  const ganhos = lista.filter((d) => d.status === "won").length;
  const perdidosLista = lista.filter((d) => d.status === "lost");
  const sairamDaPrimeira = lista.filter((d) => d.status !== "open" || (posicao.get(String(d.stage_id)) ?? 0) > 0).length;
  const contagem = new Map<string, number>();
  let semMotivo = 0;
  for (const d of perdidosLista) {
    const m = String(d.lost_reason ?? "").trim();
    if (!m) semMotivo++;
    else contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const quentesIds = config.crm_read.labels.filter((l) => suggestTemperature(l.label) === "quente").map((l) => String(l.id));
  return {
    abordadas: lista.length,
    emNegociacao: lista.filter((d) => d.status === "open").length,
    ganhos,
    perdidos: perdidosLista.length,
    quentes: quentesIds.length ? lista.filter((d) => d.status === "open" && (d.label_ids ?? []).some((id) => quentesIds.includes(String(id)))).length : null,
    valorAberto: lista.filter((d) => d.status === "open").reduce((t, d) => t + share(d).valor, 0),
    conversao: sairamDaPrimeira > 0 ? ganhos / sairamDaPrimeira : null,
    etapas,
    motivos: [...contagem.entries()].map(([motivo, negocios]) => ({ motivo, negocios })).sort((a, b) => b.negocios - a.negocios),
    perdidosSemMotivo: semMotivo,
    responsaveis,
    canais: canalOf
      ? [
          ...lista
            .reduce((m, d) => {
              const c = canalOf(d);
              const k = c ?? "\u0000";
              const x = m.get(k) ?? { canal: c, negocios: 0, ganhos: 0, abertos: 0 };
              x.negocios += 1;
              if (d.status === "won") x.ganhos += 1;
              if (d.status === "open") x.abertos += 1;
              m.set(k, x);
              return m;
            }, new Map<string, { canal: string | null; negocios: number; ganhos: number; abertos: number }>())
            .values(),
        ].sort((a, b) => (a.canal === null ? 1 : b.canal === null ? -1 : b.negocios - a.negocios))
      : [],
  };
}

// ---------- renovação ----------
export type RenewalState = "subiu" | "renovou" | "desceu" | "negociando" | "sem_negocio";
export interface RenewalRow {
  empresa: string;
  orgId: number | null;
  anterior: number;
  atual: number;
  estado: RenewalState;
  cotaAnterior: string | null;
  cotaAtual: string | null;
}

// Patrocinadores da edição anterior (ganhos no funil entre o fim da retrasada e o fim da anterior) contra esta edição.
// Até a importação da planilha, o valor da edição anterior é a soma dos produtos com o termo (qualquer código) ou o valor do negócio.
export function renewals(
  config: SponsorshipDraft,
  deals: DealRow[],
  lines: DealProductRow[],
  catalog: CatalogRow[],
  m: SponsorshipMetrics,
  prev: { inicio: string | null; fim: string },
): RenewalRow[] {
  const pipes = new Set(config.pipelines.map((p) => p.pipeline_pd_id));
  const byId = new Map(catalog.map((c) => [c.pd_id, c]));
  const prevShare = eventShare(config, lines, catalog, "");
  const chave = (d: { org_pd_id?: number | null; org_name?: string | null; title?: string | null }) => (d.org_pd_id != null ? `id:${d.org_pd_id}` : `nome:${norm(d.org_name || d.title)}`);
  const anteriores = new Map<string, RenewalRow>();
  for (const d of deals) {
    if (d.is_deleted || d.status !== "won" || d.pipeline_pd_id == null || !pipes.has(d.pipeline_pd_id)) continue;
    if (!inEdition(d.won_at, prev.inicio, prev.fim)) continue;
    const share = prevShare(d);
    if (!share.doEvento) continue;
    const own = lines.filter((l) => l.deal_id === d.id && l.is_enabled && isEventProduct({ name: byId.get(l.product_pd_id ?? -1)?.name ?? l.name }, config.product_term, ""));
    const valor = share.valor;
    const cota = own.map((l) => quotaOfProduct(byId.get(l.product_pd_id ?? -1)?.name ?? l.name, config.quotas)?.name).find(Boolean) ?? null;
    const k = chave(d);
    const r = anteriores.get(k) ?? { empresa: d.org_name || d.title || "Sem empresa", orgId: d.org_pd_id ?? null, anterior: 0, atual: 0, estado: "sem_negocio" as RenewalState, cotaAnterior: cota, cotaAtual: null };
    r.anterior += valor;
    anteriores.set(k, r);
  }
  const atualPorChave = new Map<string, { valor: number; cota: string | null }>();
  for (const v of m.vendas) {
    const k = v.orgId != null ? `id:${v.orgId}` : `nome:${norm(v.empresa)}`;
    const a = atualPorChave.get(k) ?? { valor: 0, cota: null };
    a.valor += v.valor;
    a.cota ??= v.cota;
    atualPorChave.set(k, a);
  }
  const share = eventShare(config, lines, catalog);
  const abertos = new Set(deals.filter((d) => d.status === "open" && d.pipeline_pd_id != null && pipes.has(d.pipeline_pd_id) && share(d).doEvento).map(chave));
  for (const [k, r] of anteriores) {
    const a = atualPorChave.get(k);
    if (a) {
      r.atual = a.valor;
      r.cotaAtual = a.cota;
      r.estado = a.valor > r.anterior * 1.005 ? "subiu" : a.valor < r.anterior * 0.995 ? "desceu" : "renovou";
    } else r.estado = abertos.has(k) ? "negociando" : "sem_negocio";
  }
  return [...anteriores.values()].sort((a, b) => b.anterior - a.anterior);
}

// Acumulado da edição anterior por dias antes do evento (para a chave Comparar), a partir dos mesmos negócios.
export function previousCurve(
  config: SponsorshipDraft,
  deals: DealRow[],
  lines: DealProductRow[],
  catalog: CatalogRow[],
  prev: { inicio: string | null; fim: string; abertura: string },
): ((diasAntes: number) => number) | null {
  const pipes = new Set(config.pipelines.map((p) => p.pipeline_pd_id));
  const prevShare = eventShare(config, lines, catalog, "");
  const pontos: { dias: number; valor: number }[] = [];
  for (const d of deals) {
    if (d.is_deleted || d.status !== "won" || d.pipeline_pd_id == null || !pipes.has(d.pipeline_pd_id) || !inEdition(d.won_at, prev.inicio, prev.fim)) continue;
    const share = prevShare(d);
    if (!share.doEvento) continue;
    const valor = share.valor;
    const dia = saoPauloDate(d.won_at as string);
    pontos.push({ dias: Math.round((Date.parse(`${prev.abertura}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86400000), valor });
  }
  if (!pontos.length) return null;
  return (diasAntes: number) => pontos.filter((p) => p.dias >= diasAntes).reduce((t, p) => t + p.valor, 0);
}

// ---------- recebimentos ----------
export interface InstallmentRow {
  deal_id: string;
  amount: number;
  billing_date: string | null;
}
export interface Receipts {
  porMes: { mes: string; valor: number }[];
  porAno: { ano: number; valor: number }[];
  depoisDoEvento: number;
  semCondicao: number; // vendas sem parcelas e sem campos para calcular
  permuta: number; // vendas em permuta (fora dos recebimentos)
  fonte: "parcelas" | "campos" | "misto" | "nenhuma";
}

const addMonths = (day: string, n: number) => {
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return `${d.toISOString().slice(0, 7)}-${day.slice(8, 10)}`;
};

// Parcelas do negócio no Pipedrive; sem elas, número de parcelas e 1º vencimento dos campos mapeados.
// O valor de cada parcela é proporcional à parte do evento no negócio. Permuta fica fora.
export function receipts(
  config: SponsorshipDraft,
  m: SponsorshipMetrics,
  deals: Map<string, DealRow>,
  installments: InstallmentRow[],
  eventEnd: string,
): Receipts {
  const pay = config.field_mapping.payment_method;
  const nParc = config.field_mapping.installments_count;
  const venc = config.field_mapping.first_due_date;
  const porMes = new Map<string, number>();
  let semCondicao = 0;
  let permuta = 0;
  let viaParcelas = 0;
  let viaCampos = 0;
  const porNegocio = new Map<string, number>();
  for (const v of m.vendas) porNegocio.set(v.dealId, (porNegocio.get(v.dealId) ?? 0) + v.valor);
  for (const [dealId, valorEvento] of porNegocio) {
    const d = deals.get(dealId);
    const forma = fieldText(pay, rawField(pay, d, undefined), new Map());
    if (forma && /permuta|bonifica/.test(norm(forma))) {
      permuta += valorEvento;
      continue;
    }
    const parcelas = installments.filter((p) => p.deal_id === dealId && p.billing_date);
    if (parcelas.length) {
      const total = parcelas.reduce((t, p) => t + (Number(p.amount) || 0), 0);
      const fator = total > 0 ? valorEvento / total : 0;
      for (const p of parcelas) porMes.set(String(p.billing_date).slice(0, 7), (porMes.get(String(p.billing_date).slice(0, 7)) ?? 0) + (Number(p.amount) || 0) * fator);
      viaParcelas++;
      continue;
    }
    const n = Number(String(fieldText(nParc, rawField(nParc, d, undefined), new Map()) ?? "").replace(/\D/g, "")) || 0;
    const primeiro = rawField(venc, d, undefined);
    if (n > 0 && primeiro && /^\d{4}-\d{2}-\d{2}/.test(String(primeiro))) {
      for (let i = 0; i < n; i++) {
        const mes = addMonths(String(primeiro), i).slice(0, 7);
        porMes.set(mes, (porMes.get(mes) ?? 0) + valorEvento / n);
      }
      viaCampos++;
      continue;
    }
    semCondicao += valorEvento;
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
  const anos = new Map<number, number>();
  for (const [mes, valor] of meses) anos.set(Number(mes.slice(0, 4)), (anos.get(Number(mes.slice(0, 4))) ?? 0) + valor);
  return {
    porMes: meses.map(([mes, valor]) => ({ mes, valor })),
    porAno: [...anos.entries()].map(([ano, valor]) => ({ ano, valor })),
    depoisDoEvento: meses.filter(([mes]) => mes > eventEnd.slice(0, 7)).reduce((t, [, v]) => t + v, 0),
    semCondicao,
    permuta,
    fonte: viaParcelas && viaCampos ? "misto" : viaParcelas ? "parcelas" : viaCampos ? "campos" : "nenhuma",
  };
}

// ---------- entregas ----------
export interface DeliveryRow {
  empresa: string;
  feitas: Record<string, boolean>;
}

// Status de cada entrega: opção marcada no campo "Entregas concluídas" com o nome da entrega.
// O item de chave "cupom" se marca sozinho quando um cupom da Sympla tem o nome da empresa.
export function deliveries(config: SponsorshipDraft, m: SponsorshipMetrics, deals: Map<string, DealRow>, coupons: string[]): DeliveryRow[] {
  const ref = config.field_mapping.deliveries;
  const porEmpresa = new Map<string, DeliveryRow>();
  const cuponsNorm = coupons.map((c) => norm(c).replace(/[^a-z0-9]/g, ""));
  for (const v of m.vendas) {
    if (v.adicional) continue;
    const row = porEmpresa.get(v.empresa) ?? { empresa: v.empresa, feitas: {} };
    const marcadas = setLabels(ref, rawField(ref, deals.get(v.dealId), undefined)).map(norm);
    for (const e of config.deliverables) {
      const feita = marcadas.some((x) => x === norm(e.name) || x.includes(norm(e.name)));
      if (e.key === "cupom") {
        const nome = norm(v.empresa).replace(/[^a-z0-9]/g, "");
        row.feitas[e.key] ||= feita || (nome.length >= 4 && cuponsNorm.some((c) => c.includes(nome.slice(0, Math.min(nome.length, 10)))));
      } else row.feitas[e.key] ||= feita;
    }
    porEmpresa.set(v.empresa, row);
  }
  return [...porEmpresa.values()].sort((a, b) => a.empresa.localeCompare(b.empresa, "pt-BR"));
}

// Prazo da entrega: dias antes da abertura do evento.
export const deliveryDue = (abertura: string, diasAntes: number | null) => (diasAntes == null ? null : addDays(abertura, -diasAntes));

// ---------- adicionais ----------
export interface AddonItem {
  item: string;
  quantidade: number;
  valor: number;
  vendas: number;
}
export function addonItems(m: SponsorshipMetrics): { vendidos: AddonItem[]; negociacao: AddonItem[]; semVariacao: boolean } {
  const mapa = new Map<string, AddonItem>();
  for (const v of m.vendas.filter((x) => x.adicional)) {
    const k = v.item ?? "";
    const a = mapa.get(k) ?? { item: k, quantidade: 0, valor: 0, vendas: 0 };
    a.quantidade += v.quantidade;
    a.valor += v.valor;
    a.vendas += 1;
    mapa.set(k, a);
  }
  const vendidos = [...mapa.values()].sort((a, b) => b.valor - a.valor);
  const negociacao = Object.entries(m.adicionaisAbertos)
    .map(([item, x]) => ({ item, quantidade: x.quantidade, valor: x.valor, vendas: 0 }))
    .sort((a, b) => b.valor - a.valor);
  return { vendidos, negociacao, semVariacao: [...vendidos, ...negociacao].some((a) => !a.item) };
}

// ---------- edição anterior importada da planilha ----------
// Uma linha por venda da edição anterior, guardada em event_history (source_table "sponsorship_sales").
export interface HistorySale {
  data: string | null; // AAAA-MM-DD
  empresa: string;
  produto: string | null;
  cota: string | null;
  valor: number;
  adicional: boolean;
}

export function renewalsFromHistory(history: HistorySale[], m: SponsorshipMetrics, openDeals: DealRow[]): RenewalRow[] {
  const chave = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9]/g, "");
  const anteriores = new Map<string, RenewalRow>();
  for (const h of history) {
    const k = chave(h.empresa);
    if (!k) continue;
    const r = anteriores.get(k) ?? { empresa: h.empresa, orgId: null, anterior: 0, atual: 0, estado: "sem_negocio" as RenewalState, cotaAnterior: null, cotaAtual: null };
    r.anterior += h.valor;
    if (!h.adicional && h.cota && !r.cotaAnterior) r.cotaAnterior = h.cota;
    anteriores.set(k, r);
  }
  const atual = new Map<string, { valor: number; cota: string | null }>();
  for (const v of m.vendas) {
    const k = chave(v.empresa);
    const a = atual.get(k) ?? { valor: 0, cota: null };
    a.valor += v.valor;
    a.cota ??= v.cota;
    atual.set(k, a);
  }
  const abertos = new Set(openDeals.map((d) => chave(d.org_name || d.title)));
  // A mesma empresa costuma vir escrita de jeitos diferentes na planilha e no CRM ("Flexpro Sistemas" e "Flexpro",
  // "Auxiliadora Predial" e "Auxiliadora Predial - Porto Alegre"): vale quando um nome contém o outro.
  const parecido = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)));
  const achar = <T,>(mapa: Map<string, T>, k: string) => mapa.get(k) ?? [...mapa.entries()].find(([x]) => parecido(x, k))?.[1];
  for (const [k, r] of anteriores) {
    const a = achar(atual, k);
    if (a) {
      r.atual = a.valor;
      r.cotaAtual = a.cota;
      r.estado = a.valor > r.anterior * 1.005 ? "subiu" : a.valor < r.anterior * 0.995 ? "desceu" : "renovou";
    } else r.estado = [...abertos].some((x) => parecido(x, k)) ? "negociando" : "sem_negocio";
  }
  return [...anteriores.values()].sort((a, b) => b.anterior - a.anterior);
}

// Acumulado da edição anterior no mesmo número de dias antes do evento.
export function historyCurve(history: HistorySale[], abertura: string): ((diasAntes: number) => number) | null {
  const pontos = history
    .filter((h) => h.data)
    .map((h) => ({ dias: Math.round((Date.parse(`${abertura}T12:00:00Z`) - Date.parse(`${h.data}T12:00:00Z`)) / 86400000), valor: h.valor }));
  if (!pontos.length) return null;
  return (diasAntes: number) => pontos.filter((p) => p.dias >= diasAntes).reduce((t, p) => t + p.valor, 0);
}

// ---------- evolução do valor em negociação ----------
export interface ValueHistoryRow {
  deal_id: string;
  deal_product_pd_id: number;
  product_pd_id: number | null;
  sum: number;
  is_enabled: boolean;
  changed_at: string;
}
export interface ValueChange {
  dealId: string;
  empresa: string;
  de: number;
  para: number;
  em: string; // AAAA-MM-DD
}
export interface ValueEvolution {
  serie: { dia: string; valor: number }[];
  mudancas: ValueChange[];
}

// Valor em negociação em cada dia: soma, nos negócios do evento ainda abertos naquele dia, do último valor
// conhecido dos produtos do evento. As mudanças são as trocas de valor de um negócio (sem o ponto de partida).
export function valueEvolution(
  history: ValueHistoryRow[],
  deals: Map<string, DealRow>,
  isEventLine: (productPdId: number | null) => boolean,
  hoje: string,
): ValueEvolution {
  const linhas = history.filter((h) => isEventLine(h.product_pd_id)).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  if (!linhas.length) return { serie: [], mudancas: [] };
  const dia = (iso: string) => saoPauloDate(iso);
  // Valor do negócio (soma dos produtos do evento) depois de cada registro.
  const atualPorLinha = new Map<string, number>();
  const valorNegocio = new Map<string, { em: string; valor: number }[]>();
  const mudancas: ValueChange[] = [];
  for (const h of linhas) {
    const d = deals.get(h.deal_id);
    if (!d) continue;
    const antes = [...atualPorLinha.entries()].filter(([k]) => k.startsWith(`${h.deal_id}:`)).reduce((t, [, v]) => t + v, 0);
    const primeiroDoNegocio = !valorNegocio.has(h.deal_id);
    atualPorLinha.set(`${h.deal_id}:${h.deal_product_pd_id}`, h.is_enabled ? Number(h.sum) || 0 : 0);
    const depois = [...atualPorLinha.entries()].filter(([k]) => k.startsWith(`${h.deal_id}:`)).reduce((t, [, v]) => t + v, 0);
    valorNegocio.set(h.deal_id, [...(valorNegocio.get(h.deal_id) ?? []), { em: h.changed_at, valor: depois }]);
    if (!primeiroDoNegocio && Math.abs(depois - antes) >= 0.5) mudancas.push({ dealId: h.deal_id, empresa: d.org_name || d.title || "Sem empresa", de: antes, para: depois, em: dia(h.changed_at) });
  }
  const inicio = dia(linhas[0].changed_at);
  const serie: { dia: string; valor: number }[] = [];
  for (let x = inicio; x <= hoje; x = addDays(x, 1)) {
    let total = 0;
    for (const [id, pontos] of valorNegocio) {
      const d = deals.get(id);
      if (!d) continue;
      const fechou = (d.status === "won" && d.won_at && dia(d.won_at) <= x) || (d.status === "lost" && d.lost_at && dia(d.lost_at) <= x);
      if (fechou) continue;
      const ultimo = pontos.filter((p) => dia(p.em) <= x).pop();
      if (ultimo) total += ultimo.valor;
    }
    serie.push({ dia: x, valor: total });
  }
  return { serie, mudancas: mudancas.reverse() };
}
