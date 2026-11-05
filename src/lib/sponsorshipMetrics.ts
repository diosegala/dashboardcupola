// Números da página Patrocínios, calculados a partir das tabelas do CRM no banco do painel.
// Nada aqui conhece nomes de evento, cota ou funil: tudo vem da configuração do evento.

import { isEventProduct, quotaOfProduct, type Quota, type SponsorshipDraft } from "@/lib/sponsorship";

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
}

export interface DealProductRow {
  deal_id: string;
  product_pd_id: number | null;
  name: string | null;
  quantity: number;
  sum: number;
  is_enabled: boolean;
}

export interface CatalogRow {
  pd_id: number;
  name: string | null;
  code: string | null;
}

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
  const byId = new Map(catalog.map((c) => [c.pd_id, c]));
  const linesOf = new Map<string, DealProductRow[]>();
  for (const l of lines) {
    if (!l.is_enabled) continue;
    linesOf.set(l.deal_id, [...(linesOf.get(l.deal_id) ?? []), l]);
  }
  const isEventLine = (l: DealProductRow) => {
    const p = l.product_pd_id != null ? byId.get(l.product_pd_id) : undefined;
    return isEventProduct({ name: p?.name ?? l.name, code: p?.code ?? null }, config.product_term, config.product_code);
  };

  const out: SponsorshipMetrics = { vendido: 0, vendas: [], ganhosSemProduto: [], emNegociacao: 0, negociosAbertos: 0, abertasPorCota: {} };
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
        out.vendido += valor;
        out.vendas.push({
          dealId: d.id,
          pipedriveDealId: d.pipedrive_deal_id,
          empresa,
          produto: nome,
          cota: cota?.name ?? null,
          cotaKey: cota?.key ?? null,
          quantidade: Number(l.quantity) || 0,
          valor,
          ganhoEm,
        });
      }
    } else if (d.status === "open") {
      // Aberto com produto do evento: soma esses produtos. Aberto ainda sem nenhum produto: vale o valor do negócio.
      const valor = own.length ? own.reduce((s, l) => s + (Number(l.sum) || 0), 0) : all.length ? 0 : Number(d.value) || 0;
      if (own.length || !all.length) out.negociosAbertos += 1;
      out.emNegociacao += valor;
      for (const l of own) {
        const k = quotaOfProduct(nameOf(l), config.quotas)?.key ?? "";
        out.abertasPorCota[k] = (out.abertasPorCota[k] ?? 0) + (Number(l.quantity) || 0);
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
  receita: number;
  precoMedio: number | null;
  precoTabela: number | null;
  // Desconto médio sobre a tabela (0,15 = 15%). Nulo sem preço de tabela.
  desconto: number | null;
}

export function quotaBreakdown(m: SponsorshipMetrics, quotas: Quota[], quotaGoals: Record<string, number>): QuotaRow[] {
  const row = (key: string, nome: string, q?: Quota): QuotaRow => {
    const linhas = m.vendas.filter((v) => (v.cotaKey ?? "") === key);
    const vendidas = linhas.reduce((s, v) => s + v.quantidade, 0);
    const receita = linhas.reduce((s, v) => s + v.valor, 0);
    const precoMedio = vendidas > 0 ? receita / vendidas : null;
    const precoTabela = q?.list_price && q.list_price > 0 ? q.list_price : null;
    const vagas = q?.max_slots ?? null;
    return {
      key,
      nome,
      vendidas,
      meta: quotaGoals[key] ?? null,
      vagas,
      restantes: vagas != null ? Math.max(vagas - vendidas, 0) : null,
      emNegociacao: m.abertasPorCota[key] ?? 0,
      receita,
      precoMedio,
      precoTabela,
      desconto: precoMedio != null && precoTabela ? 1 - precoMedio / precoTabela : null,
    };
  };
  const rows = [...quotas].sort((a, b) => a.order - b.order).map((q) => row(q.key, q.name, q));
  const outros = row("", "Outros produtos do evento");
  if (outros.vendidas > 0 || outros.emNegociacao > 0) rows.push(outros);
  return rows;
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

export function exampleDataset(config: SponsorshipDraft | null | undefined, inicio: string, hoje: string) {
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
  const cfg: SponsorshipDraft = {
    ...(config ?? ({} as SponsorshipDraft)),
    product_term: term,
    product_code: "",
    pipelines: [{ pipeline_pd_id: 1, represents: "varias_cotas" }],
    quotas,
  };
  const catalog: CatalogRow[] = quotas.map((q, i) => ({ pd_id: i + 1, name: `Cota ${q.name.replace(" (exemplo)", "")} - ${term}`, code: null }));
  catalog.push({ pd_id: 99, name: `Produto avulso ${term}`, code: null });
  const deals: DealRow[] = [];
  const lines: DealProductRow[] = [];
  const dias = Math.max(Math.round((Date.parse(hoje) - Date.parse(inicio)) / 86400000), 30);
  const last = quotas.length - 1;
  // Sequência fixa: o exemplo é sempre o mesmo. 99 = produto do evento sem cota pelo nome.
  const plano = [3, 2, 3, 1, 2, 3, 2, 3, 0, 1, 2, 3, 2, 3, 99, 3, 2];
  plano.forEach((idx, n) => {
    const qi = Math.min(idx, last);
    const pd = idx === 99 ? 99 : qi + 1;
    const tabela = idx === 99 ? 30000 : preco(qi);
    const dia = addDays(inicio, Math.round((dias * (n + 1)) / (plano.length + 1)));
    const id = `ex-${n + 1}`;
    deals.push({ id, pipedrive_deal_id: id, title: null, org_name: `Empresa exemplo ${n + 1}`, status: "won", value: 0, won_at: `${dia}T15:00:00Z`, pipeline_pd_id: 1 });
    lines.push({ deal_id: id, product_pd_id: pd, name: null, quantity: 1, sum: Math.round(tabela * (n % 3 === 0 ? 0.85 : n % 3 === 1 ? 0.95 : 1)), is_enabled: true });
  });
  [1, 2, 3, 2, 3, 3, 0, 2, 3, 1, 3, 2].forEach((idx, n) => {
    const qi = Math.min(idx, last);
    const id = `ex-aberto-${n + 1}`;
    deals.push({ id, pipedrive_deal_id: id, title: null, org_name: `Prospect exemplo ${n + 1}`, status: "open", value: 0, won_at: null, pipeline_pd_id: 1 });
    lines.push({ deal_id: id, product_pd_id: qi + 1, name: null, quantity: 1, sum: preco(qi), is_enabled: true });
  });
  deals.push({ id: "ex-sem-produto", pipedrive_deal_id: "ex-sem-produto", title: null, org_name: "Empresa exemplo sem produto", status: "won", value: 50000, won_at: `${addDays(inicio, Math.round(dias / 2))}T15:00:00Z`, pipeline_pd_id: 1 });
  const quotaGoals: Record<string, number> = Object.fromEntries(quotas.map((q, i) => [q.key, [2, 3, 5, 8, 4, 4][i] ?? 3]));
  return { config: cfg, deals, lines, catalog, quotaGoals };
}

// Edição anterior de exemplo: curva que chega a R$ 2,34 milhões na abertura.
export const examplePrevious = (diasAntes: number, total = 2_340_000) => Math.round(total * Math.max(0, 1 - diasAntes / 360) ** 1.1);
