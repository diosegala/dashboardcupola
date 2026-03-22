export const METRIC_OPTIONS = [
  { key: "tickets_sold", label: "Ingressos Vendidos", category: "Vendas" },
  { key: "revenue", label: "Receita (R$)", category: "Vendas" },
  { key: "meta_impressions", label: "Impressões (Meta Ads)", category: "Marketing" },
  { key: "meta_clicks", label: "Cliques (Meta Ads)", category: "Marketing" },
  { key: "meta_link_clicks", label: "Cliques no Link (Meta Ads)", category: "Marketing" },
  { key: "meta_purchases", label: "Compras - Pixel (Meta Ads)", category: "Marketing" },
  { key: "meta_spend", label: "Investimento (Meta Ads)", category: "Marketing" },
  { key: "meta_conversion_rate", label: "Taxa de Conversão (Meta Ads)", category: "Marketing" },
  { key: "google_impressions", label: "Impressões (Google Ads)", category: "Marketing" },
  { key: "google_clicks", label: "Cliques (Google Ads)", category: "Marketing" },
  { key: "email_open_rate", label: "Taxa de Abertura (RD Station)", category: "Marketing" },
  { key: "email_click_rate", label: "Taxa de Clique (RD Station)", category: "Marketing" },
  { key: "leads", label: "Leads / Cliques em E-mail", category: "Marketing" },
  { key: "site_visits", label: "Sessões do Site (GA)", category: "Marketing" },
  { key: "funnel_tofu_engagement", label: "TOFU — Engajamento", category: "Funil" },
  { key: "funnel_mofu_cart", label: "MOFU — Carrinho Mídia", category: "Funil" },
  { key: "funnel_mofu_gd_email", label: "MOFU — G.D Email", category: "Funil" },
  { key: "funnel_mofu_gd_midia", label: "MOFU — G.D Mídia", category: "Funil" },
  { key: "funnel_bofu_messages", label: "BOFU — Mensagens", category: "Funil" },
  { key: "funnel_bofu_sales", label: "BOFU — Vendas", category: "Funil" },
  { key: "funnel_bofu_revenue", label: "BOFU — Receita", category: "Funil" },
] as const satisfies readonly { key: string; label: string; category: string }[];

export function getMetricLabel(key: string): string {
  return METRIC_OPTIONS.find((m) => m.key === key)?.label ?? key;
}
