// Cards abertos do funil de ingressos configurado no evento, independentemente de produto cadastrado.

const sem = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ETAPAS = ["negociacao", "fechamento"] as const;

export type DealEtapa = {
  id: string;
  pipeline_pd_id?: number | null;
  status?: string | null;
  is_deleted?: boolean | null;
  stage_name?: string | null;
};

export type CardsEtapa = { negociacao: number; fechamento: number; total: number };

const etapaDe = (stage: string | null | undefined) => ETAPAS.find((e) => e === sem(stage)) ?? null;

export function funisDeIngressos(pipelines: unknown): number[] {
  if (!Array.isArray(pipelines)) return [];
  return pipelines.flatMap((p: unknown) => {
    if (!p || typeof p !== "object" || !("represents" in p) || p.represents !== "ingressos" || !("pipeline_pd_id" in p)) return [];
    const id = Number(p.pipeline_pd_id);
    return Number.isInteger(id) && id > 0 ? [id] : [];
  });
}

// Cada card conta uma vez, mesmo com vários produtos. Etapas fora de Negociação e Fechamento ficam de fora.
export function contarCardsEtapa(deals: DealEtapa[], funis: number[]): CardsEtapa {
  const vistos = new Set<string>();
  let negociacao = 0;
  let fechamento = 0;
  for (const d of deals) {
    if (vistos.has(d.id)) continue;
    const etapa = etapaDe(d.stage_name);
    if (!etapa || d.status !== "open" || d.is_deleted !== false || !funis.includes(d.pipeline_pd_id ?? 0)) continue;
    vistos.add(d.id);
    if (etapa === "negociacao") negociacao++;
    else fechamento++;
  }
  return { negociacao, fechamento, total: negociacao + fechamento };
}
