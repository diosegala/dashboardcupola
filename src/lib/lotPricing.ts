// Preço oficial (valor do comprador) de cada produto da Sympla, lido do cadastro de lotes.
// Regra explícita por nome: produto sem equivalência fica fora do cálculo de desconto (nunca por semelhança).
import { diaBrasilia } from "@/lib/batchCalendar";
import { CANAIS, SEM_CANAL } from "@/lib/salesChannel";

export type CampoPreco =
  | "price_standard" | "price_vip" | "price_visit" | "price_standard_visit"
  | "price_vip_visit" | "price_group_standard" | "price_group_vip" | "presale";

export const CAMPOS_PRECO: { campo: Exclude<CampoPreco, "presale">; rotulo: string }[] = [
  { campo: "price_standard", rotulo: "Padrão" },
  { campo: "price_vip", rotulo: "VIP" },
  { campo: "price_visit", rotulo: "Visita" },
  { campo: "price_standard_visit", rotulo: "Padrão + visita" },
  { campo: "price_vip_visit", rotulo: "VIP + visita" },
  { campo: "price_group_standard", rotulo: "Grupo padrão (3+)" },
  { campo: "price_group_vip", rotulo: "Grupo VIP (3+)" },
];

export type LotePreco = { name: string } & Partial<Record<Exclude<CampoPreco, "presale">, number | null>>;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Lote no nome ("Lote 1 | ...") e o tipo de preço do produto.
export function tipoDePreco(produto: string | null | undefined): { lote: string | null; campo: CampoPreco } | null {
  if (!produto) return null;
  const n = norm(produto);
  if (/^pre-?venda 2027 \| ingresso padrao( \(21 e 22\/05\))?$/.test(n)) return { lote: null, campo: "presale" };
  const m = n.match(/^lote (\d+) \| (.+)$/);
  if (!m) return null;
  const lote = `Lote ${m[1]}`;
  const r = m[2];
  const regras: [RegExp, CampoPreco][] = [
    [/^(ingresso )?padrao \(dias 20 e 21\)$/, "price_standard"],
    [/^(ingresso )?vip \(dias 20 e 21\)$/, "price_vip"],
    [/^visita \(dia 19\)$/, "price_visit"],
    [/^(padrao \+ visita|combo padrao) \(dias 19, 20 e 21\)$/, "price_standard_visit"],
    [/^vip \+ visita \(dias 19, 20 e 21\)$/, "price_vip_visit"],
    // Faturados do Pipedrive (tipo lido do produto ou do título do negócio).
    [/^ingresso padrao$/, "price_standard"],
    [/^ingresso vip$/, "price_vip"],
    [/^grupo de ingressos padrao$/, "price_group_standard"],
    [/^combo padrao$/, "price_standard_visit"],
    [/^combo vip$/, "price_vip_visit"],
    [/^visita presencial$/, "price_visit"],
    [/^1[05]% off - (a partir de 3|2 a 5|6 a 10)( -)? (ingressos )?padrao$/, "price_group_standard"],
    [/^10% off - (a partir de 3|2 a 5)( -)? (ingressos )?vip$/, "price_group_vip"],
  ];
  const achou = regras.find(([re]) => re.test(r));
  return achou ? { lote, campo: achou[1] } : null;
}

// Valor cheio de referência para desconto: produtos de grupo usam o valor do tipo base do lote,
// para o desconto de grupo aparecer como desconto. null = sem referência (fica fora do cálculo).
export function valorCheio(produto: string | null | undefined, lotes: LotePreco[], precoPreVenda?: number | null): number | null {
  const t = tipoDePreco(produto);
  if (!t) return null;
  if (t.campo === "presale") return precoPreVenda ?? null;
  const lote = lotes.find((l) => l.name === t.lote);
  if (!lote) return null;
  const campo = t.campo === "price_group_standard" ? "price_standard" : t.campo === "price_group_vip" ? "price_vip" : t.campo;
  const v = lote[campo];
  return v != null && v > 0 ? Number(v) : null;
}

// Preço de tabela que representa o lote: o Padrão do cadastro (Pré-venda usa o preço da pré-venda). null sem cadastro.
export function precoDeTabelaDoLote(lote: string, lotes: LotePreco[], precoPreVenda?: number | null): number | null {
  if (lote === "Pré-venda") return precoPreVenda != null && precoPreVenda > 0 ? Number(precoPreVenda) : null;
  const v = lotes.find((l) => l.name === lote)?.price_standard;
  return v != null && v > 0 ? Number(v) : null;
}


// ---------- Desconto médio ----------
// Sympla: compara o valor do comprador (ticket_sale_price, com a taxa absorvida) com a tabela do lote.
// Faturado: compara o valor fechado da linha do negócio com a tabela. Nunca usa o valor líquido.
export type VendaDesconto = {
  produto: string | null | undefined;
  quantidade: number;
  pago: number | null;
  fonte: "sympla" | "pipedrive";
  canal?: string;
  vendidoEm?: string | null;
  // Valor líquido só para medir a taxa em separado; nunca entra na conta do desconto.
  valorLiquido?: number | null;
};
export type Soma = { pago: number; cheio: number; vendas: number; ingressos: number; percentuais: number[] };
export type MesDesconto = { mes: string; soma: Soma; acumulada: Soma };
export type ResumoDesconto = {
  total: Soma; sympla: Soma; faturado: Soma;
  porLote: { lote: string; soma: Soma }[];
  porCanal: { canal: string; soma: Soma }[];
  porMes: MesDesconto[];
  semReferencia: { nome: string; quantidade: number; motivo: string }[];
};

const novaSoma = (): Soma => ({ pago: 0, cheio: 0, vendas: 0, ingressos: 0, percentuais: [] });
const copiaSoma = (s: Soma): Soma => ({ ...s, percentuais: [...s.percentuais] });
// Média ponderada pelo valor: 1 − pago ÷ cheio. null sem base.
export const descontoPonderado = (s: Soma) => (s.cheio > 0 ? 1 - s.pago / s.cheio : null);
// Média simples: média dos descontos de cada venda.
export const descontoSimples = (s: Soma) => (s.percentuais.length ? s.percentuais.reduce((a, b) => a + b, 0) / s.percentuais.length : null);

export function resumoDesconto(vendas: VendaDesconto[], lotes: LotePreco[], precoPreVenda?: number | null): ResumoDesconto {
  const r: ResumoDesconto = { total: novaSoma(), sympla: novaSoma(), faturado: novaSoma(), porLote: [], porCanal: [], porMes: [], semReferencia: [] };
  const lotesMap = new Map<string, Soma>();
  const canaisMap = new Map<string, Soma>();
  const mesesMap = new Map<string, Soma>();
  const sem = new Map<string, { nome: string; quantidade: number; motivo: string }>();
  const faltou = (nome: string, q: number, motivo: string) => {
    const k = `${nome}|${motivo}`;
    const atual = sem.get(k) ?? { nome, quantidade: 0, motivo };
    atual.quantidade += q;
    sem.set(k, atual);
  };
  const add = (s: Soma, pago: number, cheio: number, q: number) => {
    s.pago += pago;
    s.cheio += cheio;
    s.vendas += 1;
    s.ingressos += q;
    s.percentuais.push(1 - pago / cheio);
  };
  vendas.forEach((v) => {
    const q = v.quantidade || 0;
    if (q <= 0) return;
    const nome = String(v.produto ?? "(sem nome)");
    const t = tipoDePreco(v.produto);
    if (v.pago === 0) return;
    if (!t) return faltou(nome, q, "Produto sem equivalência na tabela de preços");
    const unit = valorCheio(v.produto, lotes, precoPreVenda);
    if (unit == null) return faltou(nome, q, `Sem preço oficial cadastrado em ${t.lote ?? "Pré-venda"}`);
    if (v.pago == null) return faltou(nome, q, "Sem valor do comprador na importação");
    const cheio = unit * q;
    add(r.total, v.pago, cheio, q);
    add(v.fonte === "pipedrive" ? r.faturado : r.sympla, v.pago, cheio, q);
    const lote = t.lote ?? "Pré-venda";
    const somaLote = lotesMap.get(lote) ?? novaSoma();
    lotesMap.set(lote, somaLote);
    add(somaLote, v.pago, cheio, q);
    if (v.canal) {
      const somaCanal = canaisMap.get(v.canal) ?? novaSoma();
      canaisMap.set(v.canal, somaCanal);
      add(somaCanal, v.pago, cheio, q);
    }
    if (v.vendidoEm) {
      const mes = diaBrasilia(v.vendidoEm).slice(0, 7);
      const somaMes = mesesMap.get(mes) ?? novaSoma();
      mesesMap.set(mes, somaMes);
      add(somaMes, v.pago, cheio, q);
    }
  });
  const ordem = (l: string) => (l === "Pré-venda" ? -1 : Number(l.replace(/\D/g, "")) || 0);
  r.porLote = [...lotesMap].map(([lote, soma]) => ({ lote, soma })).sort((a, b) => ordem(a.lote) - ordem(b.lote));
  const ordemCanais = [...CANAIS, SEM_CANAL] as string[];
  r.porCanal = [...canaisMap]
    .map(([canal, soma]) => ({ canal, soma }))
    .sort((a, b) => ordemCanais.indexOf(a.canal) - ordemCanais.indexOf(b.canal));
  const acumulada = novaSoma();
  r.porMes = [...mesesMap].sort(([a], [b]) => a.localeCompare(b)).map(([mes, soma]) => {
    const atual = copiaSoma(acumulada);
    atual.pago += soma.pago;
    atual.cheio += soma.cheio;
    atual.vendas += soma.vendas;
    atual.ingressos += soma.ingressos;
    atual.percentuais.push(...soma.percentuais);
    Object.assign(acumulada, atual);
    return { mes, soma, acumulada: copiaSoma(atual) };
  });
  r.semReferencia = [...sem.values()];
  return r;
}

// Taxa da Sympla em separado: valor do comprador menos valor líquido, sem entrar no desconto.
// O percentual usa como base tudo o que os clientes pagaram nos ingressos com valor confirmado.
export function taxaDaSympla(vendas: VendaDesconto[]) {
  let taxa = 0, base = 0, semValor = 0;
  vendas.forEach((v) => {
    if (v.fonte !== "sympla") return;
    if (v.pago == null || v.valorLiquido == null) {
      semValor += v.quantidade || 0;
      return;
    }
    base += v.pago;
    taxa += Math.max(0, v.pago - v.valorLiquido);
  });
  return { taxa, base, percentual: base > 0 ? taxa / base : null, semValor };
}
