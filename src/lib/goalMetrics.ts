// Catálogo de metas: cada item é uma meta que pode ser definida na tela Metas e o lugar exato onde ela aparece.
// Sem meta definida, o gráfico fica como está; com meta, ele ganha a sinalização.

// evento: um valor para o evento todo · periodo: vale para as datas escolhidas (compara com o período do painel)
// lote: um valor por lote de ingresso
export type GoalScope = "evento" | "periodo" | "lote";
export type GoalUnit = "num" | "brl" | "pct";

export interface GoalDef {
  // Identificador do item no catálogo (a mesma métrica pode aparecer como meta do evento e por lote).
  id: string;
  key: string;
  label: string;
  where: string;
  unit: GoalUnit;
  scope: GoalScope;
}

export interface GoalSection {
  title: string;
  description: string;
  items: GoalDef[];
}

export const GOAL_SECTIONS: GoalSection[] = [
  {
    title: "Comercial",
    description: "Um valor para o evento inteiro.",
    items: [
      { id: "paying_tickets", key: "paying_tickets", label: "Ingressos pagantes", where: "Meta do evento, Ritmo de vendas, Pagantes acumulados e Vendas por dia útil", unit: "num", scope: "evento" },
      { id: "revenue", key: "revenue", label: "Receita", where: "Receita acumulada", unit: "brl", scope: "evento" },
      { id: "issued_tickets", key: "issued_tickets", label: "Ingressos emitidos", where: "Ingressos emitidos (pagos, faturados e cortesias)", unit: "num", scope: "evento" },
    ],
  },
  {
    title: "Lotes",
    description: "Um valor por lote de ingresso.",
    items: [
      { id: "tickets_sold_lote", key: "tickets_sold", label: "Ingressos do lote", where: "Vendas por lote", unit: "num", scope: "lote" },
      { id: "revenue_lote", key: "revenue", label: "Receita do lote", where: "Vendas por lote", unit: "brl", scope: "lote" },
    ],
  },
  {
    title: "Equipe de vendas",
    description: "Quanto cada pessoa da equipe deve vender em cada lote.",
    items: [{ id: "team_sales", key: "team_sales", label: "Vendas por pessoa no lote", where: "Ranking da equipe", unit: "num", scope: "evento" }],
  },
  {
    title: "Meta Ads",
    description: "Vale para as datas da meta; aparece quando o período do painel cruza essas datas.",
    items: [
      { id: "meta_spend", key: "meta_spend", label: "Investimento", where: "Marketing › Meta Ads", unit: "brl", scope: "periodo" },
      { id: "meta_impressions", key: "meta_impressions", label: "Impressões", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
      { id: "meta_link_clicks", key: "meta_link_clicks", label: "Cliques no link", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
      { id: "meta_ctr", key: "meta_ctr", label: "CTR", where: "Marketing › Meta Ads", unit: "pct", scope: "periodo" },
      { id: "meta_purchases", key: "meta_purchases", label: "Compras (Pixel)", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
      { id: "meta_conversion_rate", key: "meta_conversion_rate", label: "Taxa de conversão", where: "Marketing › Meta Ads", unit: "pct", scope: "periodo" },
      { id: "meta_messages", key: "meta_messages", label: "Mensagens", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
      { id: "meta_add_to_cart", key: "meta_add_to_cart", label: "Adição de carrinho", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
      { id: "meta_remarketing", key: "meta_remarketing", label: "Remarketing qualificado", where: "Marketing › Meta Ads", unit: "num", scope: "periodo" },
    ],
  },
  {
    title: "E-mail (RD Station)",
    description: "Vale para as datas da meta.",
    items: [
      { id: "email_sent", key: "email_sent", label: "Campanhas enviadas", where: "Marketing › RD Station", unit: "num", scope: "periodo" },
      { id: "email_open_rate", key: "email_open_rate", label: "Taxa de abertura", where: "Marketing › RD Station", unit: "pct", scope: "periodo" },
      { id: "email_click_rate", key: "email_click_rate", label: "Taxa de clique", where: "Marketing › RD Station", unit: "pct", scope: "periodo" },
    ],
  },
  {
    title: "Site (Google Analytics)",
    description: "Vale para as datas da meta.",
    items: [
      { id: "site_visits", key: "site_visits", label: "Sessões", where: "Marketing › Site", unit: "num", scope: "periodo" },
      { id: "site_users", key: "site_users", label: "Usuários", where: "Marketing › Site", unit: "num", scope: "periodo" },
      { id: "site_conversions", key: "site_conversions", label: "Conversões", where: "Marketing › Site", unit: "num", scope: "periodo" },
      { id: "site_pageviews", key: "site_pageviews", label: "Pageviews", where: "Marketing › Site", unit: "num", scope: "periodo" },
    ],
  },
  {
    title: "Funil de KPIs",
    description: "Uma meta por semana (quinta a quarta) ou para um período maior; aparece na coluna da semana ou no Período total.",
    items: [
      { id: "funnel_tofu_engagement", key: "funnel_tofu_engagement", label: "TOFU · Engajamento", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_mofu_cart", key: "funnel_mofu_cart", label: "MOFU · Carrinho Mídia", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_mofu_gd_email", key: "funnel_mofu_gd_email", label: "MOFU · G.D Email", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_mofu_gd_midia", key: "funnel_mofu_gd_midia", label: "MOFU · G.D Mídia", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_bofu_messages", key: "funnel_bofu_messages", label: "BOFU · Mensagens", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_bofu_sales", key: "funnel_bofu_sales", label: "BOFU · Todas vendas", where: "Funil de KPIs", unit: "num", scope: "periodo" },
      { id: "funnel_bofu_revenue", key: "funnel_bofu_revenue", label: "BOFU · Receita", where: "Funil de KPIs", unit: "brl", scope: "periodo" },
    ],
  },
];

export const GOAL_DEFS = GOAL_SECTIONS.flatMap((s) => s.items);

// Item do catálogo de uma meta gravada (por lote quando tem ticket_type).
export function defOfGoal(goal: { metric_key: string; ticket_type?: string | null }): GoalDef | undefined {
  const porLote = !!goal.ticket_type;
  return GOAL_DEFS.find((d) => d.key === goal.metric_key && (d.scope === "lote") === porLote);
}

export function formatGoalValue(value: number, unit: GoalUnit): string {
  if (unit === "brl") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "pct") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString("pt-BR");
}

// Meta do evento inteiro: a mais recente daquela métrica, sem lote.
export function eventGoal<T extends { metric_key: string; ticket_type?: string | null; created_at?: string | null }>(goals: T[], key: string): T | null {
  return (
    goals
      .filter((g) => g.metric_key === key && !g.ticket_type)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null
  );
}
