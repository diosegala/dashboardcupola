// Perfil da empresa (formulário da Sympla): o formulário antigo tinha uma opção só ("Imobiliária de Venda e Locação");
// o novo permite marcar várias ("Imobiliária Aluguel|Imobiliária Venda (terceiros)|…", às vezes em formato de lista).
// Aqui as duas formas viram os mesmos perfis, para somar o que é igual.

export const PERFIS = {
  aluguel: "Aluguel",
  terceiros: "Venda de terceiros",
  lancamentos: "Lançamentos",
  corretor: "Corretor de imóveis",
  incorporadora: "Incorporadora",
  imobiliaria: "Imobiliária (sem detalhe)",
  outro: "Outro",
} as const;
export type Perfil = (typeof PERFIS)[keyof typeof PERFIS];

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function opcoes(bruto: string): string[] {
  const s = bruto.trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      /* segue como texto */
    }
  }
  return s.split(/[|;]/);
}

function perfisDaOpcao(op: string): Perfil[] {
  const o = fold(op);
  if (!o || /^\d+$/.test(o)) return [];
  const out: Perfil[] = [];
  const venda = /\bvenda\b/.test(o);
  const locacao = /(aluguel|locacao|loca[cç]ao)/.test(o);
  if (locacao) out.push(PERFIS.aluguel);
  if (/lancamento/.test(o)) out.push(PERFIS.lancamentos);
  else if (venda) out.push(PERFIS.terceiros);
  if (/corretor/.test(o)) out.push(PERFIS.corretor);
  if (/incorporad/.test(o)) out.push(PERFIS.incorporadora);
  if (/^outros?$/.test(o)) out.push(PERFIS.outro);
  if (!out.length && /^imobiliaria$/.test(o)) out.push(PERFIS.imobiliaria);
  if (!out.length) out.push(PERFIS.outro);
  return out;
}

// Perfis marcados numa resposta, sem repetir.
export function companyProfiles(bruto: string | null | undefined): Perfil[] {
  if (!bruto) return [];
  return [...new Set(opcoes(bruto).flatMap(perfisDaOpcao))];
}

// Quantos participantes marcaram cada perfil (uma pessoa pode marcar mais de um), do mais marcado para o menos.
export function countProfiles<T>(linhas: T[], resposta: (t: T) => string | null | undefined, peso: (t: T) => number) {
  const map = new Map<Perfil, number>();
  for (const t of linhas) for (const p of companyProfiles(resposta(t))) map.set(p, (map.get(p) ?? 0) + peso(t));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
