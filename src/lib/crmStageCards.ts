// Cards do Summit abertos no CRM, contados pelo funil: cada card uma vez, nas etapas Negociação e Fechamento.
// A ligação com o evento segue a mesma regra do painel: um produto com "summit" no nome.

const sem = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ETAPAS = ["negociacao", "fechamento"] as const;

export type DealEtapa = {
  id: string;
  stage_name?: string | null;
  deal_products?: { name?: string | null; is_enabled?: boolean | null }[] | null;
};

export type CardsEtapa = { negociacao: number; fechamento: number; total: number };

const etapaDe = (stage: string | null | undefined) => ETAPAS.find((e) => e === sem(stage)) ?? null;

const doSummit = (d: DealEtapa) => (d.deal_products ?? []).some((p) => p.is_enabled !== false && sem(p.name).includes("summit"));

// Cada card conta uma vez, mesmo com vários produtos. Etapas fora de Negociação e Fechamento ficam de fora.
export function contarCardsEtapa(deals: DealEtapa[]): CardsEtapa {
  const vistos = new Set<string>();
  let negociacao = 0;
  let fechamento = 0;
  for (const d of deals) {
    if (vistos.has(d.id)) continue;
    const etapa = etapaDe(d.stage_name);
    if (!etapa || !doSummit(d)) continue;
    vistos.add(d.id);
    if (etapa === "negociacao") negociacao++;
    else fechamento++;
  }
  return { negociacao, fechamento, total: negociacao + fechamento };
}
