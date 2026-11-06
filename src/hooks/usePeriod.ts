import { useState } from "react";
import { getWholeRange, type DateRange } from "@/hooks/useDashboardData";

// Período do painel, o mesmo em todas as páginas. Sem escolha, vale o evento inteiro.
// A escolha fica guardada na sessão do navegador e some ao sair ou quando o login expira (clearPeriod).
const CHAVE = "cupola-periodo";

function ler(): DateRange | null {
  try {
    const v = sessionStorage.getItem(CHAVE);
    if (!v) return null;
    const { from, to } = JSON.parse(v);
    return { from: new Date(from), to: new Date(to) };
  } catch {
    return null;
  }
}

export function clearPeriod() {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem armazenamento: nada a limpar */
  }
}

export function usePeriod(): [DateRange, (r: DateRange) => void] {
  const [range, setRange] = useState<DateRange>(() => ler() ?? getWholeRange());
  const set = (r: DateRange) => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({ from: r.from.toISOString(), to: r.to.toISOString() }));
    } catch {
      /* sem armazenamento, vale só nesta página */
    }
    setRange(r);
  };
  return [range, set];
}
