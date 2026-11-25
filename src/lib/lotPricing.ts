// Preço oficial (valor do comprador) de cada produto da Sympla, lido do cadastro de lotes.
// Regra explícita por nome: produto sem equivalência fica fora do cálculo de desconto (nunca por semelhança).

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

// ---------- Desconto médio (etapa 2) ----------
// Sympla: compara o valor do comprador (ticket_sale_price, com a taxa absorvida) com a tabela do lote.
// Faturado: compara o valor fechado da linha do negócio com a tabela. Nunca usa o valor líquido.
export type VendaDesconto = { produto: string | null | undefined; quantidade: number; pago: number | null; fonte: "sympla" | "pipedrive" };
export type Soma = { pago: number; cheio: number; vendas: number; percentuais: number[] };
export type ResumoDesconto = {
  total: Soma; sympla: Soma; faturado: Soma;
  porLote: { lote: string; soma: Soma }[];
  semReferencia: { nome: string; quantidade: number; motivo: string }[];
};

const novaSoma = (): Soma => ({ pago: 0, cheio: 0, vendas: 0, percentuais: [] });
// Média ponderada pelo valor: 1 − pago ÷ cheio. null sem base.
export const descontoPonderado = (s: Soma) => (s.cheio > 0 ? 1 - s.pago / s.cheio : null);
// Média simples: média dos descontos de cada venda.
export const descontoSimples = (s: Soma) => (s.percentuais.length ? s.percentuais.reduce((a, b) => a + b, 0) / s.percentuais.length : null);

export function resumoDesconto(vendas: VendaDesconto[], lotes: LotePreco[], precoPreVenda?: number | null): ResumoDesconto {
  const r: ResumoDesconto = { total: novaSoma(), sympla: novaSoma(), faturado: novaSoma(), porLote: [], semReferencia: [] };
  const lotesMap = new Map<string, Soma>();
  const sem = new Map<string, { nome: string; quantidade: number; motivo: string }>();
  const faltou = (nome: string, q: number, motivo: string) => {
    const k = `${nome}|${motivo}`;
    const atual = sem.get(k) ?? { nome, quantidade: 0, motivo };
    atual.quantidade += q;
    sem.set(k, atual);
  };
  vendas.forEach((v) => {
    const q = v.quantidade || 0;
    if (q <= 0) return;
    const nome = String(v.produto ?? "(sem nome)");
    const t = tipoDePreco(v.produto);
    if (v.pago === 0 || t?.campo === "price_visit") return;
    if (!t) return faltou(nome, q, "Produto sem equivalência na tabela de preços");
    const unit = valorCheio(v.produto, lotes, precoPreVenda);
    if (unit == null) return faltou(nome, q, `Sem preço oficial cadastrado em ${t.lote ?? "Pré-venda"}`);
    if (v.pago == null) return faltou(nome, q, "Sem valor do comprador na importação");
    const cheio = unit * q;
    const add = (s: Soma) => { s.pago += v.pago as number; s.cheio += cheio; s.vendas += 1; s.percentuais.push(1 - (v.pago as number) / cheio); };
    add(r.total);
    add(v.fonte === "pipedrive" ? r.faturado : r.sympla);
    const lote = t.lote ?? "Pré-venda";
    const somaLote = lotesMap.get(lote) ?? novaSoma();
    lotesMap.set(lote, somaLote);
    add(somaLote);
  });
  const ordem = (l: string) => (l === "Pré-venda" ? -1 : Number(l.replace(/\D/g, "")) || 0);
  r.porLote = [...lotesMap].map(([lote, soma]) => ({ lote, soma })).sort((a, b) => ordem(a.lote) - ordem(b.lote));
  r.semReferencia = [...sem.values()];
  return r;
}
