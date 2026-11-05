import { describe, expect, it } from "vitest";
import { valueEvolution, type ValueHistoryRow } from "@/lib/sponsorshipExtra";
import { addDays, saoPauloDate } from "@/lib/sponsorshipMetrics";

// Versão anterior da evolução do valor (lenta), guardada só para provar que a nova dá exatamente o mesmo resultado.
function valueEvolutionAntiga(history: ValueHistoryRow[], deals: Map<string, any>, isEventLine: (p: number | null) => boolean, hoje: string) {
  const linhas = history.filter((h) => isEventLine(h.product_pd_id)).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  if (!linhas.length) return { serie: [], mudancas: [] };
  const dia = (iso: string) => saoPauloDate(iso);
  const atualPorLinha = new Map<string, number>();
  const valorNegocio = new Map<string, { em: string; valor: number }[]>();
  const mudancas: any[] = [];
  for (const h of linhas) {
    const d = deals.get(h.deal_id);
    if (!d) continue;
    const antes = [...atualPorLinha.entries()].filter(([k]) => k.startsWith(`${h.deal_id}:`)).reduce((t, [, v]) => t + v, 0);
    const primeiroDoNegocio = !valorNegocio.has(h.deal_id);
    atualPorLinha.set(`${h.deal_id}:${h.deal_product_pd_id}`, h.is_enabled ? Number(h.sum) || 0 : 0);
    const depois = [...atualPorLinha.entries()].filter(([k]) => k.startsWith(`${h.deal_id}:`)).reduce((t, [, v]) => t + v, 0);
    valorNegocio.set(h.deal_id, [...(valorNegocio.get(h.deal_id) ?? []), { em: h.changed_at, valor: depois }]);
    if (!primeiroDoNegocio && Math.abs(depois - antes) >= 0.5) mudancas.push({ dealId: h.deal_id, empresa: d.org_name || d.title || "Sem empresa", de: antes, para: depois, em: dia(h.changed_at) });
  }
  const inicio = dia(linhas[0].changed_at);
  const serie: { dia: string; valor: number }[] = [];
  for (let x = inicio; x <= hoje; x = addDays(x, 1)) {
    let total = 0;
    for (const [id, pontos] of valorNegocio) {
      const d = deals.get(id);
      if (!d) continue;
      const fechou = (d.status === "won" && d.won_at && dia(d.won_at) <= x) || (d.status === "lost" && d.lost_at && dia(d.lost_at) <= x);
      if (fechou) continue;
      const ultimo = pontos.filter((p) => dia(p.em) <= x).pop();
      if (ultimo) total += ultimo.valor;
    }
    serie.push({ dia: x, valor: total });
  }
  return { serie, mudancas: mudancas.reverse() };
}

// Gerador de números repetível, para o teste dar o mesmo resultado sempre.
function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function cenario(negocios: number, registros: number, semente: number) {
  const r = sorteio(semente);
  const inicio = "2025-11-01";
  const deals = new Map<string, any>();
  for (let i = 0; i < negocios; i++) {
    const sorte = r();
    const fecha = `${addDays(inicio, Math.floor(r() * 300))}T15:00:00Z`;
    deals.set(`d${i}`, {
      id: `d${i}`,
      title: `Negócio ${i}`,
      org_name: i % 7 === 0 ? null : `Empresa ${i}`,
      status: sorte < 0.4 ? "open" : sorte < 0.7 ? "won" : "lost",
      won_at: fecha,
      lost_at: fecha,
    });
  }
  const history: ValueHistoryRow[] = [];
  for (let i = 0; i < registros; i++) {
    history.push({
      deal_id: `d${Math.floor(r() * negocios)}`,
      deal_product_pd_id: Math.floor(r() * 3) + 1,
      product_pd_id: r() < 0.9 ? 1 : 2,
      sum: Math.round(r() * 20) * 5000,
      is_enabled: r() < 0.9,
      changed_at: `${addDays(inicio, Math.floor(r() * 330))}T${String(Math.floor(r() * 24)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00Z`,
    });
  }
  return { deals, history };
}

describe("evolução do valor: versão rápida", () => {
  it("dá exatamente o mesmo resultado da versão anterior em vários cenários", () => {
    for (const [negocios, registros, semente] of [[5, 20, 1], [40, 300, 2], [120, 900, 3], [60, 60, 4]] as const) {
      const { deals, history } = cenario(negocios, registros, semente);
      const hoje = "2026-11-04";
      expect(valueEvolution(history, deals, (p) => p === 1, hoje)).toEqual(valueEvolutionAntiga(history, deals, (p) => p === 1, hoje));
    }
  });

  it("continua rápida com o volume de uma conta grande (500 negócios, 4000 registros)", () => {
    // A versão anterior levava cerca de 2 segundos nesse volume; esta leva dezenas de milissegundos.
    const { deals, history } = cenario(500, 4000, 7);
    const t0 = performance.now();
    valueEvolution(history, deals, (p) => p === 1, "2026-11-04");
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
