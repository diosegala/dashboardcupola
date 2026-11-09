import { useMemo } from "react";
import { useEvent } from "@/hooks/useEvent";
import { useSponsorshipConfig, useSponsorshipData, useSponsorshipHistory } from "@/hooks/useSponsorship";
import { quotaOfProduct, quotasFromCatalog, type SponsorshipDraft } from "@/lib/sponsorship";
import { addDays, computeSponsorship, type CatalogRow, type DealProductRow, type DealRow, type SaleLine } from "@/lib/sponsorshipMetrics";
import type { HistorySale } from "@/lib/sponsorshipExtra";

// Cotas como estão no catálogo do CRM (mesma regra da página Patrocínios).
export function quotasDoCrm(cfg: SponsorshipDraft, lines: DealProductRow[], catalog: CatalogRow[]) {
  const nomes = lines.filter((l) => l.is_enabled).map((l) => catalog.find((c) => c.pd_id === l.product_pd_id)?.name ?? l.name);
  const comVenda = new Set(nomes.map((n) => quotaOfProduct(n ?? "", cfg.quotas)?.key).filter(Boolean) as string[]);
  return quotasFromCatalog(catalog, cfg.product_term, cfg.product_code, cfg.quotas, comVenda);
}

// Vendas de patrocínio da edição anterior por data: planilha oficial importada; sem ela, os ganhos do CRM na janela anterior.
export function previousSponsorSales(
  hist: HistorySale[],
  cfg: SponsorshipDraft,
  deals: DealRow[],
  lines: DealProductRow[],
  catalog: CatalogRow[],
  prev: { inicio: string; fim: string } | null,
): { data: string | null; valor: number }[] | null {
  if (hist.length) return hist.map((h) => ({ data: h.data, valor: h.valor }));
  if (!prev) return null;
  const m = computeSponsorship(cfg, deals, lines, catalog, { previousEnd: prev.inicio, eventEnd: prev.fim });
  return m.vendas.length ? m.vendas.map((v) => ({ data: v.ganhoEm, valor: v.valor })) : null;
}

// Vendas de patrocínio do evento do topo, com as mesmas regras da página Patrocínios (para a aba Comercial).
export function useSponsorshipSales(): {
  vendas: SaleLine[];
  anterior: { data: string | null; valor: number }[] | null;
  configurado: boolean;
  isLoading: boolean;
} {
  const { event, events } = useEvent();
  const config = useSponsorshipConfig(event.id);
  const data = useSponsorshipData(config.data);
  const anterior = events.find((e) => e.slug === event.previous_event_slug);
  const retrasada = anterior ? events.find((e) => e.slug === anterior.previous_event_slug) : undefined;
  const historico = useSponsorshipHistory(anterior?.slug);
  return useMemo(() => {
    const cfg0 = config.data;
    const configurado = !!cfg0?.crm_account && !!cfg0.pipelines.length;
    const isLoading = config.isLoading || (data.isLoading && data.fetchStatus !== "idle");
    if (!configurado || !data.data || !data.data.deals.length) return { vendas: [], anterior: null, configurado, isLoading };
    const { deals, lines, catalog } = data.data;
    const cfg = { ...cfg0!, quotas: quotasDoCrm(cfg0!, lines, catalog) };
    const m = computeSponsorship(cfg, deals, lines, catalog, { previousEnd: anterior?.end_date ?? null, eventEnd: event.end_date });
    const prev = anterior ? { inicio: retrasada?.end_date ?? addDays(anterior.end_date, -365), fim: anterior.end_date } : null;
    return { vendas: m.vendas, anterior: previousSponsorSales(historico.data ?? [], cfg, deals, lines, catalog, prev), configurado, isLoading };
  }, [config.data, config.isLoading, data.data, data.isLoading, data.fetchStatus, historico.data, event, anterior, retrasada]);
}
