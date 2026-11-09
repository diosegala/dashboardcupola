// Catálogo de metas: cada item é uma meta que pode ser definida na tela Metas e o lugar exato onde ela aparece.
// Sem meta definida, o gráfico fica como está; com meta, ele ganha a sinalização.

// evento: um valor para o evento todo · periodo: vale para as datas escolhidas (compara com o período do painel)
// lote: um valor por lote de ingresso · cota: um valor por cota de patrocínio · ano: um valor por ano de recebimento
// canal: um valor por canal de venda em cada lote (canal em quota_key, lote em ticket_type)
export type GoalScope = "evento" | "periodo" | "lote" | "cota" | "ano" | "canal";

// Canais de venda sugeridos na meta por canal (os mesmos nomes da aba Marketing › Links). Outro nome pode ser digitado.
export const CANAIS_DE_VENDA = ["BDR", "Anúncios", "Equipe CUPOLA", "Imobi Report", "E-mail marketing", "Patrocinadores", "Instagram Rodrigo", "Redes sociais"];
export type GoalUnit = "num" | "brl" | "pct";

export interface GoalDef {
  // Identificador do item no catálogo (a mesma métrica pode aparecer como meta do evento e por lote).
  id: string;
  key: string;
  label: string;
  where: string;
  unit: GoalUnit;
  scope: GoalScope;
  // Texto do "i" da meta.
  info?: string;
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
      { id: "revenue", key: "revenue", label: "Meta de receita (R$)", where: "Card Receita acumulada e gráfico Receita acumulada x meta", unit: "brl", scope: "evento" },
      { id: "issued_tickets", key: "issued_tickets", label: "Ingressos emitidos", where: "Ingressos emitidos (pagos, faturados e cortesias)", unit: "num", scope: "evento" },
      { id: "ticket_average", key: "ticket_average", label: "Ticket médio (R$)", where: "Card Receita acumulada › Ticket médio", unit: "brl", scope: "evento" },
    ],
  },
  {
    title: "Patrocínio",
    description: "Metas de patrocínio do evento selecionado. As cotas vêm da configuração do patrocínio do evento.",
    items: [
      { id: "sponsor_revenue_target", key: "sponsor_revenue_target", label: "Meta ampliada (R$)", where: "Patrocínios › Receita de patrocínio e Receita acumulada x meta", unit: "brl", scope: "evento", info: "Receita de patrocínio que a equipe persegue. Aparece em Receita de patrocínio e Receita acumulada x meta." },
      { id: "sponsor_revenue_floor", key: "sponsor_revenue_floor", label: "Meta mínima (R$)", where: "Patrocínios › Receita de patrocínio", unit: "brl", scope: "evento", info: "Piso aceitável de venda de patrocínio. Aparece como marca no card Receita de patrocínio." },
      { id: "sponsor_budget", key: "sponsor_budget", label: "Orçamento (R$)", where: "Patrocínios › Receita de patrocínio", unit: "brl", scope: "evento", info: "Receita de patrocínio prevista no orçamento do evento (DRE). Aparece como marca no card Receita de patrocínio." },
      { id: "sponsor_quotas", key: "sponsor_quotas", label: "Cotas vendidas", where: "Patrocínios › Cotas vendidas", unit: "num", scope: "cota", info: "Quantidade a vender em cada nível de cota. Aparece em Cotas vendidas." },
      { id: "sponsor_receipts", key: "sponsor_receipts", label: "Recebimento no ano (R$)", where: "Patrocínios › Recebimentos (quando o campo de vencimento existir)", unit: "brl", scope: "ano", info: "Caixa de patrocínio que deve entrar no ano. Aparece em Recebimentos." },
      { id: "sponsor_approaches", key: "sponsor_approaches", label: "Abordagens", where: "Patrocínios › Prospecção", unit: "num", scope: "periodo", info: "Empresas a abordar nas datas da meta. Com conversão de 7%, define o volume de prospecção. Aparece em Prospecção." },
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
    title: "Canais de venda",
    description: "Quantos ingressos cada canal deve vender em cada lote, como no planejamento.",
    items: [
      { id: "channel_sales", key: "channel_sales", label: "Vendas do canal no lote", where: "Comercial › Vendas por canal", unit: "num", scope: "canal", info: "Ingressos que o canal deve vender no lote. Na aba Links do Marketing, escolha o lote para ver vendidos, meta, % e quanto falta. Em Evento todo, as metas dos lotes somam." },
    ],
  },
  {
    title: "Equipe de vendas",
    description: "Quantos pagantes cada pessoa da equipe deve vender por lote. O valor é o mesmo para todos os lotes e pessoas.",
    items: [{ id: "team_sales", key: "team_sales", label: "Vendas por pessoa no lote", where: "Ranking da equipe", unit: "num", scope: "evento" }],
  },
  {
    title: "Marketing › Visão geral",
    description: "Vale para as datas da meta; aparece quando o período do painel cruza essas datas.",
    items: [
      { id: "media_spend", key: "media_spend", label: "Investimento em mídia", where: "Marketing › Visão geral", unit: "brl", scope: "periodo" },
      { id: "media_cost_per_ticket", key: "media_cost_per_ticket", label: "Investimento por ingresso (R$)", where: "Marketing › Visão geral", unit: "brl", scope: "periodo", info: "Teto: quanto menor, melhor. Fica Na meta enquanto estiver igual ou abaixo do valor." },
      { id: "media_roas", key: "media_roas", label: "Receita por real investido", where: "Marketing › Visão geral", unit: "num", scope: "periodo", info: "Quantos reais em vendas para cada R$ 1 investido. Use 5 para 5x." },
      { id: "links_tracked_rate", key: "links_tracked_rate", label: "Vendas com link parametrizado", where: "Marketing › Visão geral", unit: "pct", scope: "periodo" },
    ],
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
      { id: "meta_cpc", key: "meta_cpc", label: "CPC (R$)", where: "Marketing › Meta Ads", unit: "brl", scope: "periodo", info: "Teto: quanto menor, melhor. Fica Na meta enquanto estiver igual ou abaixo do valor." },
    ],
  },
  {
    title: "Google Ads",
    description: "Vale para as datas da meta; aparece quando o período do painel cruza essas datas.",
    items: [
      { id: "google_spend", key: "google_spend", label: "Investimento", where: "Marketing › Google Ads", unit: "brl", scope: "periodo" },
      { id: "google_impressions", key: "google_impressions", label: "Impressões", where: "Marketing › Google Ads", unit: "num", scope: "periodo" },
      { id: "google_link_clicks", key: "google_link_clicks", label: "Cliques no link", where: "Marketing › Google Ads", unit: "num", scope: "periodo" },
      { id: "google_ctr", key: "google_ctr", label: "CTR", where: "Marketing › Google Ads", unit: "pct", scope: "periodo" },
      { id: "google_cpc", key: "google_cpc", label: "CPC (R$)", where: "Marketing › Google Ads", unit: "brl", scope: "periodo", info: "Teto: quanto menor, melhor. Fica Na meta enquanto estiver igual ou abaixo do valor." },
      { id: "google_purchases", key: "google_purchases", label: "Conversões", where: "Marketing › Google Ads", unit: "num", scope: "periodo" },
      { id: "google_conversion_rate", key: "google_conversion_rate", label: "Taxa de conversão", where: "Marketing › Google Ads", unit: "pct", scope: "periodo" },
    ],
  },
  {
    title: "E-mail (RD Station)",
    description: "Vale para as datas da meta.",
    items: [
      { id: "email_sent", key: "email_sent", label: "Campanhas enviadas", where: "Marketing › RD Station", unit: "num", scope: "periodo" },
      { id: "email_delivery_rate", key: "email_delivery_rate", label: "Taxa de entrega", where: "Marketing › RD Station", unit: "pct", scope: "periodo" },
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

// Item do catálogo de uma meta gravada (por lote quando tem ticket_type, por cota com quota_key, por ano com receipt_year).
export function defOfGoal(goal: { metric_key: string; ticket_type?: string | null; quota_key?: string | null; receipt_year?: number | null }): GoalDef | undefined {
  const porCanal = GOAL_DEFS.find((d) => d.scope === "canal" && d.key === goal.metric_key);
  if (porCanal) return porCanal;
  const scope = goal.ticket_type ? "lote" : goal.quota_key ? "cota" : goal.receipt_year ? "ano" : null;
  return GOAL_DEFS.find((d) => d.key === goal.metric_key && (scope ? d.scope === scope : !["lote", "cota", "ano"].includes(d.scope)));
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
