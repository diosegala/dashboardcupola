import { useMemo } from "react";
import { Eye, MousePointerClick, Wallet, BarChart3, Mail, Globe, Users, FileText } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { ClicksByDayChart } from "./charts/ClicksByDayChart";
import { SessionsByDayChart } from "./charts/SessionsByDayChart";
import { findGoal } from "@/hooks/useDashboardData";

interface MarketingSectionProps {
  adMetrics: any[];
  emailCampaigns: any[];
  siteAnalytics: any[];
  goals: any[];
}

export function MarketingSection({ adMetrics, emailCampaigns, siteAnalytics, goals }: MarketingSectionProps) {
  const meta = useMemo(() => adMetrics.filter((a) => a.source === "meta"), [adMetrics]);
  const google = useMemo(() => adMetrics.filter((a) => a.source === "google_ads"), [adMetrics]);

  const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
  const avg = (arr: any[], key: string) => arr.length > 0 ? sum(arr, key) / arr.length : 0;

  // Site totals
  const siteTotals = useMemo(() => ({
    sessions: sum(siteAnalytics, "sessions"),
    users: sum(siteAnalytics, "users"),
    newUsers: sum(siteAnalytics, "new_users"),
    pageviews: sum(siteAnalytics, "pageviews"),
  }), [siteAnalytics]);

  // Email totals
  const emailTotals = useMemo(() => ({
    sent: emailCampaigns.length,
    openRate: avg(emailCampaigns, "open_rate"),
    clickRate: avg(emailCampaigns, "click_rate"),
    leads: sum(emailCampaigns, "total_clicked"),
  }), [emailCampaigns]);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Marketing</h2>

      {/* Meta Ads */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Meta Ads</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Impressões" value={sum(meta, "impressions")} icon={Eye} goal={findGoal(goals, "meta_impressions")?.target_value} />
          <MetricCard title="Cliques" value={sum(meta, "clicks")} icon={MousePointerClick} goal={findGoal(goals, "meta_clicks")?.target_value} />
          <MetricCard title="Gasto" value={sum(meta, "spend").toFixed(2)} icon={Wallet} prefix="R$ " description="Investimento no período" />
          <MetricCard title="CTR Médio" value={`${avg(meta, "ctr").toFixed(2)}%`} icon={BarChart3} description="Taxa de cliques média" />
        </div>
      </div>

      {/* Google Ads */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Google Ads</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Impressões" value={sum(google, "impressions")} icon={Eye} goal={findGoal(goals, "google_impressions")?.target_value} />
          <MetricCard title="Cliques" value={sum(google, "clicks")} icon={MousePointerClick} goal={findGoal(goals, "google_clicks")?.target_value} />
          <MetricCard title="Gasto" value={sum(google, "spend").toFixed(2)} icon={Wallet} prefix="R$ " description="Investimento no período" />
          <MetricCard title="Conversões" value={sum(google, "conversions")} icon={BarChart3} description="Total de conversões" />
        </div>
      </div>

      {/* RD Station */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">RD Station</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Campanhas Enviadas" value={emailTotals.sent} icon={Mail} description="No período selecionado" />
          <MetricCard title="Taxa de Abertura" value={`${emailTotals.openRate.toFixed(1)}%`} icon={Mail} goal={findGoal(goals, "email_open_rate")?.target_value} />
          <MetricCard title="Taxa de Clique" value={`${emailTotals.clickRate.toFixed(1)}%`} icon={MousePointerClick} goal={findGoal(goals, "email_click_rate")?.target_value} />
          <MetricCard title="Leads (Cliques)" value={emailTotals.leads} icon={Users} goal={findGoal(goals, "leads")?.target_value} />
        </div>
      </div>

      {/* Site */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Site (Google Analytics)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Sessões" value={siteTotals.sessions} icon={Globe} goal={findGoal(goals, "site_visits")?.target_value} />
          <MetricCard title="Usuários" value={siteTotals.users} icon={Users} description="Total de usuários" />
          <MetricCard title="Novos Usuários" value={siteTotals.newUsers} icon={Users} description="Primeiro acesso" />
          <MetricCard title="Pageviews" value={siteTotals.pageviews} icon={FileText} description="Visualizações de página" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ClicksByDayChart adMetrics={adMetrics} />
        <SessionsByDayChart siteAnalytics={siteAnalytics} />
      </div>
    </section>
  );
}
