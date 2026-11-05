// Números da página Patrocínios, calculados a partir das tabelas do CRM no banco do painel.
// Nada aqui conhece nomes de evento, cota ou funil: tudo vem da configuração do evento.

import { DEFAULT_DELIVERABLES, EMPTY_DRAFT, isEventProduct, quotaOfProduct, type Quota, type SponsorshipDraft } from "@/lib/sponsorship";

export interface DealRow {
  id: string;
  pipedrive_deal_id: string;
  title: string | null;
  org_name: string | null;
  status: string | null;
  value: number | null;
  won_at: string | null;
  pipeline_pd_id: number | null;
  is_deleted?: boolean;
  // Campos usados por Prospecção, Renovação, Vendas e Recebimentos (opcionais nos testes).
  org_pd_id?: number | null;
  owner_name?: string | null;
  stage_id?: string | null;
  stage_changed_at?: string | null;
  created_at_source?: string | null;
  lost_at?: string | null;
  lost_reason?: string | null;
  label_ids?: (number | string)[] | null;
  custom_fields?: Record<string, unknown> | null;
  products_count?: number | null;
}

export interface DealProductRow {
  deal_id: string;
  product_pd_id: number | null;
  variation_pd_id?: number | null;
  name: string | null;
  quantity: number;
  sum: number;
  is_enabled: boolean;
}

export interface CatalogRow {
  pd_id: number;
  name: string | null;
  code: string | null;
  // "product" ou "variation" (variação de um produto, ex.: cada item adicional).
  kind?: string | null;
  parent_pd_id?: number | null;
  is_deleted?: boolean | null;
}

// Chave da linha de adicionais no card de cotas.
export const ADDONS_KEY = "__adicionais";
// Produto adicional: tem variações (um item por variação) ou se chama "adicional/adicionais".
export const isAddonProduct = (name: string | null | undefined, hasVariation: boolean) => hasVariation || /\badiciona/i.test(String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, ""));

// Metas de patrocínio no menu Metas (chaves da tabela goals).
export const SPONSOR_GOAL_KEYS = {
  ampliada: "sponsor_revenue_target",
  minima: "sponsor_revenue_floor",
  orcamento: "sponsor_budget",
  cotas: "sponsor_quotas",
  recebimento: "sponsor_receipts",
  abordagens: "sponsor_approaches",
} as const;

export interface SponsorshipGoals {
  ampliada: number | null;
  minima: number | null;
  orcamento: number | null;
}

export interface SaleLine {
  dealId: string;
  pipedriveDealId: string;
  empresa: string;
  produto: string;
  cota: string | null;
  cotaKey: string | null;
  // Item adicional (variação do produto de adicionais). Nulo quando não é adicional.
  adicional: boolean;
  item: string | null;
  orgId: number | null;
  closer: string | null;
  quantidade: number;
  valor: number;
  ganhoEm: string;
}

export interface SponsorshipMetrics {
  vendido: number;
  vendas: SaleLine[];
  // Negócios ganhos na edição sem produto do evento: fora da receita, com aviso discreto em "ver detalhes".
  ganhosSemProduto: { pipedriveDealId: string; empresa: string; ganhoEm: string }[];
  emNegociacao: number;
  negociosAbertos: number;
  // Unidades de cada cota em negócios abertos (chave da cota; "" = produto do evento sem cota pelo nome).
  abertasPorCota: Record<string, number>;
  // Valor (R$) de cada cota em negócios abertos.
  abertasValorPorCota: Record<string, number>;
  // Adicionais em negócios abertos: item -> { quantidade, valor }.
  adicionaisAbertos: Record<string, { quantidade: number; valor: number }>;
  // Negócios abertos com produto do evento sem valor (R$ 0) no Pipedrive: o valor em negociação fica incompleto.
  abertosSemValor: number;
}

// Dia do ganho no fuso de São Paulo (AAAA-MM-DD).
const spDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export const saoPauloDate = (iso: string) => spDay.format(new Date(iso));

// Edição pela data do ganho: depois do último dia da edição anterior e até o último dia desta.
export function inEdition(wonAt: string | null, previousEnd: string | null, eventEnd: string) {
  if (!wonAt) return false;
  const day = saoPauloDate(wonAt);
  return (!previousEnd || day > previousEnd) && day <= eventEnd;
}

export function computeSponsorship(
  config: SponsorshipDraft,
  deals: DealRow[],
  lines: DealProductRow[],
  catalog: CatalogRow[],
  window: { previousEnd: string | null; eventEnd: string },
): SponsorshipMetrics {
  const pipes = new Set(config.pipelines.map((p) => p.pipeline_pd_id));
  const byId = new Map(catalog.filter((c) => (c.kind ?? "product") === "product").map((c) => [c.pd_id, c]));
  const variations = new Map(catalog.filter((c) => c.kind === "variation").map((c) => [c.pd_id, c]));
  const itemOf = (l: DealProductRow) => (l.variation_pd_id != null ? variations.get(l.variation_pd_id)?.name ?? null : null);
  const linesOf = new Map<string, DealProductRow[]>();
  for (const l of lines) {
    if (!l.is_enabled) continue;
    linesOf.set(l.deal_id, [...(linesOf.get(l.deal_id) ?? []), l]);
  }
  const isEventLine = (l: DealProductRow) => {
    const p = l.product_pd_id != null ? byId.get(l.product_pd_id) : undefined;
    return isEventProduct({ name: p?.name ?? l.name, code: p?.code ?? null }, config.product_term, config.product_code);
  };

  const out: SponsorshipMetrics = { vendido: 0, vendas: [], ganhosSemProduto: [], emNegociacao: 0, negociosAbertos: 0, abertasPorCota: {}, abertasValorPorCota: {}, adicionaisAbertos: {}, abertosSemValor: 0 };
  // Linha de cota: cota pelo nome; sem cota, adicional ou "outros".
  const keyOf = (l: DealProductRow, nome: string) => quotaOfProduct(nome, config.quotas)?.key ?? (isAddonProduct(nome, l.variation_pd_id != null) ? ADDONS_KEY : "");
  const nameOf = (l: DealProductRow) => (l.product_pd_id != null ? byId.get(l.product_pd_id)?.name : null) ?? l.name ?? "Produto";
  for (const d of deals) {
    if (d.is_deleted || d.pipeline_pd_id == null || !pipes.has(d.pipeline_pd_id)) continue;
    const all = linesOf.get(d.id) ?? [];
    const own = all.filter(isEventLine);
    const empresa = d.org_name || d.title || "Sem empresa";
    if (d.status === "won" && inEdition(d.won_at, window.previousEnd, window.eventEnd)) {
      const ganhoEm = saoPauloDate(d.won_at as string);
      if (!own.length) {
        out.ganhosSemProduto.push({ pipedriveDealId: d.pipedrive_deal_id, empresa, ganhoEm });
        continue;
      }
      for (const l of own) {
        const nome = nameOf(l);
        const valor = Number(l.sum) || 0;
        const cota = quotaOfProduct(nome, config.quotas);
        const adicional = !cota && keyOf(l, nome) === ADDONS_KEY;
        out.vendido += valor;
        out.vendas.push({
          dealId: d.id,
          pipedriveDealId: d.pipedrive_deal_id,
          empresa,
          produto: nome,
          cota: cota?.name ?? null,
          cotaKey: cota?.key ?? null,
          adicional,
          item: adicional ? itemOf(l) : null,
          orgId: d.org_pd_id ?? null,
          closer: d.owner_name ?? null,
          quantidade: Number(l.quantity) || 0,
          valor,
          ganhoEm,
        });
      }
    } else if (d.status === "open") {
      // Aberto com produto do evento: soma esses produtos. Aberto ainda sem nenhum produto: vale o valor do negócio.
      const valor = own.length ? own.reduce((s, l) => s + (Number(l.sum) || 0), 0) : all.length ? 0 : Number(d.value) || 0;
      if (own.length || !all.length) out.negociosAbertos += 1;
      if (own.length && valor <= 0) out.abertosSemValor += 1;
      out.emNegociacao += valor;
      for (const l of own) {
        const k = keyOf(l, nameOf(l));
        out.abertasPorCota[k] = (out.abertasPorCota[k] ?? 0) + (Number(l.quantity) || 0);
        out.abertasValorPorCota[k] = (out.abertasValorPorCota[k] ?? 0) + (Number(l.sum) || 0);
        if (k === ADDONS_KEY) {
          const item = itemOf(l) ?? "";
          const a = (out.adicionaisAbertos[item] ??= { quantidade: 0, valor: 0 });
          a.quantidade += Number(l.quantity) || 0;
          a.valor += Number(l.sum) || 0;
        }
      }
    }
  }
  return out;
}

// ---------- cotas vendidas ----------
export interface QuotaRow {
  key: string; // "" = Outros produtos do evento
  nome: string;
  vendidas: number;
  meta: number | null;
  vagas: number | null;
  restantes: number | null;
  emNegociacao: number;
  // Valor (R$) da cota em negócios abertos.
  valorNegociacao: number;
  receita: number;
  precoMedio: number | null;
}

export function quotaBreakdown(m: SponsorshipMetrics, quotas: Quota[], quotaGoals: Record<string, number>): QuotaRow[] {
  const row = (key: string, nome: string, q?: Quota): QuotaRow => {
    const linhas = m.vendas.filter((v) => (v.cotaKey ?? (v.adicional ? ADDONS_KEY : "")) === key);
    const vendidas = linhas.reduce((s, v) => s + v.quantidade, 0);
    const receita = linhas.reduce((s, v) => s + v.valor, 0);
    const precoMedio = vendidas > 0 ? receita / vendidas : null;
    const vagas = q?.max_slots ?? null;
    return {
      key,
      nome,
      vendidas,
      meta: quotaGoals[key] ?? null,
      vagas,
      restantes: vagas != null ? Math.max(vagas - vendidas, 0) : null,
      emNegociacao: m.abertasPorCota[key] ?? 0,
      valorNegociacao: m.abertasValorPorCota[key] ?? 0,
      receita,
      precoMedio,
    };
  };
  const rows = [...quotas].sort((a, b) => a.order - b.order).map((q) => row(q.key, q.name, q));
  const adicionais = row(ADDONS_KEY, "Adicionais");
  if (adicionais.vendidas > 0 || adicionais.emNegociacao > 0) rows.push(adicionais);
  const outros = row("", "Outros produtos do evento");
  if (outros.vendidas > 0 || outros.emNegociacao > 0) rows.push(outros);
  return rows;
}

// Meta, vendido, % da meta e quanto falta, por cota. Só cotas de verdade (sem "Adicionais" nem "Outros produtos").
export interface QuotaTargetRow {
  key: string;
  nome: string;
  meta: number | null;
  vendidas: number;
  emNegociacao: number;
  pct: number | null;
  falta: number | null;
}

export function quotaTargets(rows: QuotaRow[]): { rows: QuotaTargetRow[]; total: QuotaTargetRow | null } {
  const linhas = rows
    .filter((r) => r.key !== "" && r.key !== ADDONS_KEY && ((r.meta ?? 0) > 0 || r.vendidas > 0 || r.emNegociacao > 0))
    .map((r): QuotaTargetRow => {
      const meta = r.meta != null && r.meta > 0 ? r.meta : null;
      return {
        key: r.key,
        nome: r.nome,
        meta,
        vendidas: r.vendidas,
        emNegociacao: r.emNegociacao,
        pct: meta != null ? r.vendidas / meta : null,
        falta: meta != null ? Math.max(meta - r.vendidas, 0) : null,
      };
    });
  const comMeta = linhas.filter((l) => l.meta != null);
  if (comMeta.length === 0) return { rows: linhas, total: null };
  const meta = comMeta.reduce((s, l) => s + (l.meta ?? 0), 0);
  const vendidas = comMeta.reduce((s, l) => s + l.vendidas, 0);
  const total: QuotaTargetRow = {
    key: "__total__",
    nome: "Total",
    meta,
    vendidas,
    emNegociacao: comMeta.reduce((s, l) => s + l.emNegociacao, 0),
    pct: vendidas / meta,
    falta: comMeta.reduce((s, l) => s + (l.falta ?? 0), 0),
  };
  return { rows: linhas, total };
}

// Vendas por responsável (closer do negócio). Ainda não há meta por responsável: mostra o que cada um fechou.
export interface CloserRow {
  closer: string;
  negocios: number;
  quantidade: number;
  valor: number;
  parte: number;
}

export const SEM_CLOSER = "Sem closer";

export function closerBreakdown(vendas: SaleLine[]): CloserRow[] {
  const total = vendas.reduce((s, v) => s + v.valor, 0);
  const mapa = new Map<string, { negocios: Set<string>; quantidade: number; valor: number }>();
  for (const v of vendas) {
    const nome = v.closer?.trim() || SEM_CLOSER;
    const g = mapa.get(nome) ?? { negocios: new Set<string>(), quantidade: 0, valor: 0 };
    g.negocios.add(v.dealId);
    g.quantidade += v.quantidade;
    g.valor += v.valor;
    mapa.set(nome, g);
  }
  return [...mapa.entries()]
    .map(([closer, g]) => ({ closer, negocios: g.negocios.size, quantidade: g.quantidade, valor: g.valor, parte: total > 0 ? g.valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor || a.closer.localeCompare(b.closer, "pt-BR"));
}

// ---------- receita acumulada semana a semana ----------
export interface WeekPoint {
  label: string;
  inicio: string;
  receita: number | null;
  cotas: number | null;
  ritmo: number | null;
  anterior: number | null;
}

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

// Semanas desde o início da edição até a abertura do evento. O ritmo necessário liga o acumulado de hoje à meta na abertura.
// `anterior` devolve o acumulado da edição anterior no mesmo número de dias antes do evento.
export function weeklySeries(
  m: SponsorshipMetrics,
  opts: { inicio: string; abertura: string; hoje: string; meta: number | null; anterior?: ((diasAntes: number) => number | null) | null },
): { semanas: WeekPoint[]; semanasRestantes: number; ritmoSemanal: number | null } {
  const vendas = [...m.vendas].sort((a, b) => a.ganhoEm.localeCompare(b.ganhoEm));
  const inicio = vendas.length && vendas[0].ganhoEm < opts.inicio ? vendas[0].ganhoEm : opts.inicio;
  const semanas: WeekPoint[] = [];
  for (let d = inicio; d <= opts.abertura; d = addDays(d, 7)) {
    const fim = addDays(d, 6);
    const passou = d <= opts.hoje;
    const ate = vendas.filter((v) => v.ganhoEm <= fim);
    const diasAntes = Math.round((Date.parse(`${opts.abertura}T12:00:00Z`) - Date.parse(`${fim}T12:00:00Z`)) / 86400000);
    semanas.push({
      label: ddmm(d),
      inicio: d,
      receita: passou ? ate.reduce((s, v) => s + v.valor, 0) : null,
      cotas: passou ? ate.filter((v) => v.cotaKey).reduce((s, v) => s + v.quantidade, 0) : null,
      ritmo: null,
      anterior: opts.anterior ? opts.anterior(Math.max(diasAntes, 0)) : null,
    });
  }
  const atual = semanas.reduce((idx, w, i) => (w.inicio <= opts.hoje ? i : idx), -1);
  const restantes = Math.max(semanas.length - 1 - atual, 0);
  let ritmoSemanal: number | null = null;
  if (opts.meta && atual >= 0 && m.vendido < opts.meta) {
    const falta = opts.meta - m.vendido;
    ritmoSemanal = restantes > 0 ? falta / restantes : falta;
    for (let i = atual; i < semanas.length; i++) semanas[i].ritmo = m.vendido + ritmoSemanal * (i - atual);
  }
  return { semanas, semanasRestantes: restantes, ritmoSemanal };
}

// ---------- dados de exemplo ----------
// Para a revisão, enquanto a integração não traz os números reais. Empresas e valores fictícios.
// As cotas vêm da configuração do evento quando existem.
export const EXAMPLE_GOALS: SponsorshipGoals = { ampliada: 2_600_000, minima: 2_300_000, orcamento: 2_250_000 };

export function exampleDataset(config: SponsorshipDraft | null | undefined, inicio: string, hoje: string, inicioAnterior?: string) {
  // Sem cotas cadastradas, o exemplo usa níveis de patrocínio comuns, marcados como exemplo no próprio nome.
  // Assim que o evento tiver cotas na configuração, o exemplo passa a usar as cotas dele.
  const genericas: Quota[] = [
    { key: "exemplo_platina", name: "Platina (exemplo)", order: 1, list_price: 180000, max_slots: 3 },
    { key: "exemplo_ouro", name: "Ouro (exemplo)", order: 2, list_price: 120000, max_slots: 4 },
    { key: "exemplo_prata", name: "Prata (exemplo)", order: 3, list_price: 80000, max_slots: 6 },
    { key: "exemplo_bronze", name: "Bronze (exemplo)", order: 4, list_price: 40000, max_slots: 10 },
  ];
  const quotas = config?.quotas?.length ? config.quotas : genericas;
  const precos = [180000, 120000, 80000, 40000, 25000, 15000];
  const preco = (i: number) => quotas[i]?.list_price ?? precos[Math.min(i, precos.length - 1)];
  const term = "exemplo";
  const entregas = config?.deliverables?.length ? config.deliverables : DEFAULT_DELIVERABLES;
  const opcoesEntrega = entregas.map((e, i) => ({ id: i + 1, label: e.name }));
  const formas = [
    { id: 1, label: "Boleto" },
    { id: 2, label: "PIX" },
    { id: 3, label: "Bonificação / Permuta" },
  ];
  const cfg: SponsorshipDraft = {
    ...EMPTY_DRAFT,
    ...(config ?? {}),
    product_term: term,
    product_code: "",
    pipelines: [{ pipeline_pd_id: 1, represents: "varias_cotas" }],
    quotas,
    deliverables: entregas,
    // Campos de exemplo, para os cards que dependem de campo aparecerem na revisão.
    field_mapping: {
      payment_method: { object: "deal", field_key: "ex_pagamento", name: "Forma de pagamento", field_type: "enum", options: formas },
      installments_count: { object: "deal", field_key: "ex_parcelas", name: "Número de parcelas", field_type: "varchar" },
      first_due_date: { object: "deal", field_key: "ex_vencimento", name: "1º vencimento", field_type: "date" },
      contract_status: { object: "deal", field_key: "ex_contrato", name: "Status do contrato", field_type: "enum", options: [{ id: 1, label: "Contrato assinado" }, { id: 2, label: "Sem contrato" }] },
      deliveries: { object: "deal", field_key: "ex_entregas", name: "Entregas concluídas", field_type: "set", options: opcoesEntrega },
    },
    crm_read: { read_at: `${hoje}T12:00:00Z`, labels: [{ id: 1, label: "Quente" }, { id: 2, label: "Morno" }, { id: 3, label: "Frio" }] },
  };
  const catalog: CatalogRow[] = quotas.map((q, i) => ({ pd_id: i + 1, name: `Cota ${q.name.replace(" (exemplo)", "")} - ${term}`, code: null, kind: "product" }));
  catalog.push({ pd_id: 99, name: `Produto avulso ${term}`, code: null, kind: "product" });
  catalog.push({ pd_id: 98, name: `Adicionais - ${term}`, code: null, kind: "product" });
  const itens = ["Estação de café", "Painel na área VIP", "Credencial de expositor"];
  itens.forEach((nome, i) => catalog.push({ pd_id: 900 + i, name: nome, code: null, kind: "variation", parent_pd_id: 98 }));

  const etapas = ["Lead", "Tentativa de contato", "Contato estabelecido", "Reunião", "Negociação", "Fechamento"].map((name, i) => ({
    pd_id: 500 + i,
    pipeline_pd_id: 1,
    name,
    order_nr: i + 1,
    days_to_rotten: null,
  }));
  const deals: DealRow[] = [];
  const lines: DealProductRow[] = [];
  const installments: { deal_id: string; amount: number; billing_date: string | null }[] = [];
  const dias = Math.max(Math.round((Date.parse(hoje) - Date.parse(inicio)) / 86400000), 30);
  const last = quotas.length - 1;
  const vendedoras = ["Vendedora exemplo 1", "Vendedora exemplo 2"];
  // Sequência fixa: o exemplo é sempre o mesmo. 99 = produto do evento sem cota pelo nome; 98 = adicional.
  const plano = [3, 2, 3, 1, 2, 3, 98, 2, 3, 0, 1, 2, 98, 3, 2, 3, 99, 3, 2, 98];
  plano.forEach((idx, n) => {
    const qi = Math.min(idx, last);
    const pd = idx >= 98 ? idx : qi + 1;
    const tabela = idx === 99 ? 30000 : idx === 98 ? [8600, 12000, 1770][n % 3] : preco(qi);
    const dia = addDays(inicio, Math.round((dias * (n + 1)) / (plano.length + 1)));
    const id = `ex-${n + 1}`;
    const parcelas = [1, 3, 6, 10][n % 4];
    deals.push({
      id,
      pipedrive_deal_id: id,
      title: null,
      org_name: `Empresa exemplo ${n + 1}`,
      org_pd_id: 10_000 + n,
      owner_name: vendedoras[n % 2],
      status: "won",
      value: 0,
      won_at: `${dia}T15:00:00Z`,
      pipeline_pd_id: 1,
      stage_id: String(etapas[5].pd_id),
      custom_fields: {
        ex_pagamento: n % 9 === 8 ? 3 : n % 3 === 0 ? 2 : 1,
        ex_parcelas: String(parcelas),
        ex_vencimento: addDays(dia, 10),
        ex_contrato: n % 5 === 4 ? 2 : 1,
        ex_entregas: opcoesEntrega.filter((_, j) => (n + j) % 3 !== 0).map((o) => o.id),
      },
    });
    lines.push({ deal_id: id, product_pd_id: pd, variation_pd_id: idx === 98 ? 900 + (n % 3) : null, name: null, quantity: idx === 98 && n % 3 === 2 ? 3 : 1, sum: Math.round(tabela * (n % 3 === 0 ? 0.85 : n % 3 === 1 ? 0.95 : 1)), is_enabled: true });
  });
  [1, 2, 3, 2, 3, 3, 0, 2, 3, 1, 3, 2].forEach((idx, n) => {
    const qi = Math.min(idx, last);
    const id = `ex-aberto-${n + 1}`;
    const etapa = etapas[[0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 1][n]];
    deals.push({
      id,
      pipedrive_deal_id: id,
      title: null,
      org_name: n < 3 ? `Patrocinador anterior exemplo ${n + 1}` : `Prospect exemplo ${n + 1}`,
      org_pd_id: n < 3 ? 20_000 + n : 30_000 + n,
      owner_name: vendedoras[n % 2],
      status: "open",
      value: preco(qi),
      won_at: null,
      pipeline_pd_id: 1,
      stage_id: String(etapa.pd_id),
      stage_changed_at: `${addDays(hoje, -[3, 9, 21, 6, 30, 12, 4, 18, 2, 25, 7, 40][n])}T12:00:00Z`,
      label_ids: n % 4 === 0 ? [1] : n % 4 === 1 ? [3] : [],
    });
    lines.push({ deal_id: id, product_pd_id: qi + 1, name: null, quantity: 1, sum: preco(qi), is_enabled: true });
  });
  lines.push({ deal_id: "ex-aberto-2", product_pd_id: 98, variation_pd_id: 901, name: null, quantity: 1, sum: 12000, is_enabled: true });
  const motivos = ["Sem retorno", "Sem retorno", "Sem verba para patrocínio", "Outros", "", "Data do evento não atende", "Sem retorno", ""];
  for (let n = 0; n < 40; n++) {
    const id = `ex-perdido-${n + 1}`;
    deals.push({
      id,
      pipedrive_deal_id: id,
      title: null,
      org_name: `Empresa perdida exemplo ${n + 1}`,
      owner_name: vendedoras[n % 2],
      status: "lost",
      value: 0,
      won_at: null,
      lost_at: `${addDays(inicio, Math.round((dias * (n + 1)) / 41))}T12:00:00Z`,
      lost_reason: motivos[n % motivos.length] || null,
      pipeline_pd_id: 1,
      stage_id: String(etapas[[0, 1, 1, 2, 3, 4][n % 6]].pd_id),
    });
  }
  deals.push({ id: "ex-sem-produto", pipedrive_deal_id: "ex-sem-produto", title: null, org_name: "Empresa exemplo sem produto", status: "won", value: 50000, won_at: `${addDays(inicio, Math.round(dias / 2))}T15:00:00Z`, pipeline_pd_id: 1 });

  // Edição anterior de exemplo: parte dos patrocinadores renova (mesmas empresas), parte ainda não.
  const ini = inicioAnterior ?? addDays(inicio, -365);
  for (let n = 0; n < 14; n++) {
    const id = `ex-anterior-${n + 1}`;
    const renova = n < 9;
    deals.push({
      id,
      pipedrive_deal_id: id,
      title: null,
      org_name: renova ? `Empresa exemplo ${n + 1}` : n < 12 ? `Patrocinador anterior exemplo ${n - 8}` : `Patrocinador anterior exemplo ${n - 8}`,
      org_pd_id: renova ? 10_000 + n : 20_000 + (n - 9),
      status: "won",
      value: [90000, 60000, 85000, 120000, 70000, 40000, 30000, 80000, 45000, 150000, 60000, 40000, 25000, 35000][n],
      won_at: `${addDays(ini, 20 + n * 22)}T15:00:00Z`,
      pipeline_pd_id: 1,
    });
  }
  const quotaGoals: Record<string, number> = Object.fromEntries(quotas.map((q, i) => [q.key, [2, 3, 5, 8, 4, 4][i] ?? 3]));
  return { config: cfg, deals, lines, catalog, quotaGoals, stages: etapas, installments, orgs: [] as { pd_id: number; name: string | null; custom_fields: Record<string, unknown> | null }[], users: [] as { pd_id: number; name: string | null }[] };
}

// Edição anterior de exemplo: curva que chega a R$ 2,34 milhões na abertura.
export const examplePrevious = (diasAntes: number, total = 2_340_000) => Math.round(total * Math.max(0, 1 - diasAntes / 360) ** 1.1);
