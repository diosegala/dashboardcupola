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
  if (/^pre-?venda 2027 \| ingresso padrao$/.test(n)) return { lote: null, campo: "presale" };
  const m = n.match(/^lote (\d+) \| (.+)$/);
  if (!m) return null;
  const lote = `Lote ${m[1]}`;
  const r = m[2];
  const regras: [RegExp, CampoPreco][] = [
    [/^padrao \(dias 20 e 21\)$/, "price_standard"],
    [/^vip \(dias 20 e 21\)$/, "price_vip"],
    [/^visita \(dia 19\)$/, "price_visit"],
    [/^(padrao \+ visita|combo padrao) \(dias 19, 20 e 21\)$/, "price_standard_visit"],
    [/^vip \+ visita \(dias 19, 20 e 21\)$/, "price_vip_visit"],
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
