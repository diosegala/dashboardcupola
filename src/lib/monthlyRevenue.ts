// Faturamento mês a mês (horário de Brasília), usado pelos cards de ingressos, patrocínios e Receita acumulada.
// Regra pura: recebe as vendas já filtradas (aprovadas, sem cancelados) e devolve um ponto por mês.

const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" });
const NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// "AAAA-MM" de uma data/hora ISO no horário de Brasília. Datas sem hora (AAAA-MM-DD) usam o próprio mês.
export function mesBrasilia(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  return FMT.format(new Date(iso)).slice(0, 7);
}

export function somaMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function rotuloMes(mes: string, comAno = false): string {
  const [a, m] = mes.split("-");
  return `${NOMES[Number(m) - 1]}${comAno ? `/${a.slice(2)}` : ""}`;
}

// Meses de início a fim (inclusive).
export function listaMeses(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let m = inicio; m <= fim && out.length < 60; m = somaMeses(m, 1)) out.push(m);
  return out;
}

export interface TicketLike {
  sold_at?: string | null;
  quantity?: number | null;
  total_price?: number | string | null;
}

export interface TicketMonth {
  mes: string;
  label: string;
  parcial: boolean;
  futuro: boolean;
  sympla: number;
  faturado: number;
  total: number;
  ingressos: number;
  acumulado: number;
  // Receita do ano anterior no mesmo mês (null sem dados do ano anterior).
  anoAnterior: number | null;
  meta: number | null;
}

const valorDe = (t: TicketLike) => Number(t.total_price || 0);
const qtdDe = (t: TicketLike) => Number(t.quantity || 0);

function porMes<T>(lista: T[], data: (x: T) => string | null | undefined, valor: (x: T) => number, desloca = 0) {
  const mapa = new Map<string, number>();
  for (const x of lista) {
    const d = data(x);
    if (!d) continue;
    const k = somaMeses(mesBrasilia(d), desloca);
    mapa.set(k, (mapa.get(k) ?? 0) + valor(x));
  }
  return mapa;
}

// Ingressos: Sympla pela data da compra e faturados pela data do ganho (ambos já em sold_at).
export function ticketMonthly(opts: {
  sympla: TicketLike[];
  faturados: TicketLike[];
  anterior?: TicketLike[]; // pagantes do evento anterior (Sympla + faturados)
  inicio?: string | null; // mês inicial; sem ele, o mês da primeira venda
  fim: string; // mês do evento
  hoje: string; // mês atual
  metas?: Record<string, number>;
}): TicketMonth[] {
  const { sympla, faturados, anterior, fim, hoje, metas = {} } = opts;
  const todos = [...sympla, ...faturados];
  const primeiro = todos.reduce<string | null>((min, t) => {
    if (!t.sold_at) return min;
    const m = mesBrasilia(t.sold_at);
    return !min || m < min ? m : min;
  }, null);
  let inicio = opts.inicio ?? primeiro ?? hoje;
  if (primeiro && primeiro < inicio) inicio = primeiro;
  const ultimo = todos.reduce((max, t) => (t.sold_at && mesBrasilia(t.sold_at) > max ? mesBrasilia(t.sold_at) : max), fim);
  const s = porMes(sympla, (t) => t.sold_at, valorDe);
  const f = porMes(faturados, (t) => t.sold_at, valorDe);
  const q = porMes(todos, (t) => t.sold_at, qtdDe);
  const ant = anterior && anterior.length ? porMes(anterior, (t) => t.sold_at, valorDe, 12) : null;
  let acc = 0;
  return listaMeses(inicio, ultimo).map((mes) => {
    const sympla = s.get(mes) ?? 0;
    const faturado = f.get(mes) ?? 0;
    acc += sympla + faturado;
    return {
      mes,
      label: rotuloMes(mes),
      parcial: mes === hoje,
      futuro: mes > hoje,
      sympla,
      faturado,
      total: sympla + faturado,
      ingressos: q.get(mes) ?? 0,
      acumulado: acc,
      anoAnterior: ant ? ant.get(mes) ?? 0 : null,
      meta: metas[mes] ?? null,
    };
  });
}

export interface SponsorSaleLike {
  ganhoEm: string; // AAAA-MM-DD (Brasília)
  valor: number;
  quantidade: number;
  cotaKey: string | null;
  cota: string | null;
  adicional: boolean;
}

export interface SponsorMonth {
  mes: string;
  label: string;
  parcial: boolean;
  futuro: boolean;
  valor: number;
  cotas: number;
  // Valor e quantidade de cada cota (chave da cota; "__adicionais" e "__outros" para o que não é cota).
  porCota: Record<string, { nome: string; valor: number; quantidade: number }>;
  semValor: number;
  acumulado: number;
  anoAnterior: number | null;
  previsto: number | null;
}

export const ADICIONAIS = "__adicionais";
export const OUTROS = "__outros";

export function sponsorMonthly(opts: {
  vendas: SponsorSaleLike[];
  anterior?: { data: string | null; valor: number }[] | null;
  previsto?: { mes: string; valor: number }[] | null; // receita prevista por mês de pagamento
  inicio?: string | null;
  fim: string;
  hoje: string;
}): SponsorMonth[] {
  const { vendas, anterior, previsto, fim, hoje } = opts;
  const primeiro = vendas.reduce<string | null>((min, v) => (!min || v.ganhoEm.slice(0, 7) < min ? v.ganhoEm.slice(0, 7) : min), null);
  let inicio = opts.inicio ?? primeiro ?? hoje;
  if (primeiro && primeiro < inicio) inicio = primeiro;
  const ant = anterior && anterior.length ? porMes(anterior, (h) => h.data, (h) => h.valor, 12) : null;
  const prev = previsto && previsto.length ? new Map(previsto.map((p) => [p.mes, p.valor])) : null;
  let acc = 0;
  return listaMeses(inicio, fim < inicio ? inicio : fim).map((mes) => {
    const doMes = vendas.filter((v) => v.ganhoEm.slice(0, 7) === mes);
    const porCota: SponsorMonth["porCota"] = {};
    let valor = 0;
    let cotas = 0;
    let semValor = 0;
    for (const v of doMes) {
      const k = v.cotaKey ?? (v.adicional ? ADICIONAIS : OUTROS);
      const nome = v.cota ?? (v.adicional ? "Adicionais" : "Outros");
      const c = (porCota[k] ??= { nome, valor: 0, quantidade: 0 });
      c.valor += v.valor;
      c.quantidade += v.quantidade;
      valor += v.valor;
      if (v.cotaKey) cotas += v.quantidade;
      if (!(v.valor > 0)) semValor += 1;
    }
    acc += valor;
    return {
      mes,
      label: rotuloMes(mes),
      parcial: mes === hoje,
      futuro: mes > hoje,
      valor,
      cotas,
      porCota,
      semValor,
      acumulado: acc,
      anoAnterior: ant ? ant.get(mes) ?? 0 : null,
      previsto: prev ? prev.get(mes) ?? 0 : null,
    };
  });
}

// Metas de receita cadastradas para um mês fechado (1º ao último dia do mesmo mês): mês -> valor.
export function monthlyRevenueGoals(goals: { metric_key: string; ticket_type?: string | null; period_start: string; period_end: string; target_value: number | string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of goals) {
    if (g.metric_key !== "revenue" || g.ticket_type) continue;
    const ini = g.period_start.slice(0, 10);
    const fim = g.period_end.slice(0, 10);
    if (ini.slice(8) !== "01" || ini.slice(0, 7) !== fim.slice(0, 7)) continue;
    const [a, m] = fim.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    if (Number(fim.slice(8)) !== ultimo) continue;
    const v = Number(g.target_value);
    if (v > 0) out[ini.slice(0, 7)] = v;
  }
  return out;
}

// Junta ingressos e patrocínios num só eixo de meses.
export interface TotalMonth {
  mes: string;
  label: string;
  parcial: boolean;
  futuro: boolean;
  ingressos: number;
  patrocinios: number;
  total: number;
  acumulado: number;
}

export function totalMonthly(t: { mes: string; total: number }[], s: { mes: string; valor: number }[], hoje: string): TotalMonth[] {
  const meses = [...new Set([...t.map((x) => x.mes), ...s.map((x) => x.mes)])].sort();
  if (!meses.length) return [];
  const ti = new Map(t.map((x) => [x.mes, x.total]));
  const si = new Map(s.map((x) => [x.mes, x.valor]));
  let acc = 0;
  return listaMeses(meses[0], meses[meses.length - 1]).map((mes) => {
    const ingressos = ti.get(mes) ?? 0;
    const patrocinios = si.get(mes) ?? 0;
    acc += ingressos + patrocinios;
    return { mes, label: rotuloMes(mes), parcial: mes === hoje, futuro: mes > hoje, ingressos, patrocinios, total: ingressos + patrocinios, acumulado: acc };
  });
}
