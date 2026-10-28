// Perguntas do formulário da Sympla viram temas curtos, e respostas parecidas são agrupadas.

// Tema de cada pergunta. null = não vira gráfico (já tem gráfico próprio ou é dado de contato).
const TEMAS: [RegExp, string | null][] = [
  [/acessibilidade/i, "Acessibilidade"],
  [/visita presencial/i, "Visita presencial"],
  [/^\s*cargo\s*$/i, "Cargo"],
  [/perfil da empresa/i, null],
  [/estado|\buf\b/i, null],
  [/^\s*empresa\s*$/i, "Empresas"],
  [/^\s*cidade\s*$/i, "Cidades"],
];

export function questionTheme(question: string): string | null {
  for (const [re, tema] of TEMAS) if (re.test(question)) return tema;
  // Pergunta nova: usa o texto sem "?" e sem o começo "Você", "Qual", "Em qual".
  const curto = question
    .replace(/\?+\s*$/, "")
    .replace(/^(voc[eê]|qual|quais|em qual|como)\s+/i, "")
    .trim();
  return curto.charAt(0).toUpperCase() + curto.slice(1);
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Junta variações da mesma resposta ("não", "Nao", "NÃO preciso" → "Não").
export function answerKey(answer: string): { key: string; label: string } {
  const limpo = answer.replace(/\s+/g, " ").trim();
  const base = semAcento(limpo).toLowerCase().replace(/[.!]+$/, "");
  if (/^(nao|n|nenhum|nenhuma|nao preciso|nao necessito|nao, obrigad[oa])\b/.test(base)) return { key: "nao", label: "Não" };
  if (/^(sim|s)$/.test(base)) return { key: "sim", label: "Sim" };
  return { key: base, label: limpo.charAt(0).toUpperCase() + limpo.slice(1) };
}

export interface ThemeChart {
  title: string;
  items: { label: string; value: number }[];
  distinct: number;
}

// Agrupa as contagens por tema e por resposta normalizada; mostra as 8 respostas mais comuns.
export function themeCharts(rows: { question: string; answer: string; total: number }[]): ThemeChart[] {
  const temas = new Map<string, Map<string, { label: string; value: number }>>();
  rows.forEach((r) => {
    const tema = questionTheme(r.question);
    if (!tema) return;
    const { key, label } = answerKey(r.answer);
    const respostas = temas.get(tema) ?? new Map();
    const atual = respostas.get(key) ?? { label, value: 0 };
    atual.value += Number(r.total);
    respostas.set(key, atual);
    temas.set(tema, respostas);
  });
  return Array.from(temas.entries()).map(([title, respostas]) => {
    const items = Array.from(respostas.values()).sort((a, b) => b.value - a.value);
    return { title, items: items.slice(0, 8), distinct: items.length };
  });
}
