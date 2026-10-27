import { useState } from "react";

// Linha de referência do ano anterior: fina, tracejada, neutra e nunca sólida (briefing 6.1, item 1).
export const PREVIOUS_YEAR_KEY = "anoAnterior";
export const PREVIOUS_YEAR_LABEL = "Ano anterior";

export const previousYearLineProps = {
  dataKey: PREVIOUS_YEAR_KEY,
  name: PREVIOUS_YEAR_LABEL,
  type: "monotone" as const,
  stroke: "hsl(var(--muted-foreground))",
  strokeWidth: 1.25,
  strokeDasharray: "4 4",
  strokeOpacity: 0.7,
  dot: false,
  activeDot: false as const,
  animationDuration: 1000,
};

// Estado das séries de um gráfico: quais estão ocultas e qual está em destaque pela legenda.
export function useSeriesVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Opacidade de uma série: as outras esmaecem quando uma está em destaque.
  const opacity = (key: string, base = 1) => (focused && focused !== key ? 0.22 : base);

  return { hidden, focused, setFocused, toggle, opacity };
}
