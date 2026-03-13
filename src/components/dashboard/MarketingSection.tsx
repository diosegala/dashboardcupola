import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, MousePointerClick, Wallet, BarChart3, Mail, Globe, Users, FileText, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "./MetricCard";
import { ClicksByDayChart } from "./charts/ClicksByDayChart";
import { SessionsByDayChart } from "./charts/SessionsByDayChart";
import { ConversionFunnelChart } from "./charts/ConversionFunnelChart";
import { DemandGenTable } from "./charts/DemandGenTable";
import { DemandGenByDayChart } from "./charts/DemandGenByDayChart";
import { SourceBreakdownTable } from "./SourceBreakdownTable";
import { findGoal, type DateRange } from "@/hooks/useDashboardData";
import { CampaignFilter, type Campaign } from "./CampaignFilter";

interface MarketingSectionProps {
  adMetrics: any[];
  emailCampaigns: any[];
  siteAnalytics: any[];
  ga4Events: any[];
  goals: any[];
  range: DateRange;
}

export function MarketingSection({ adMetrics, emailCampaigns, siteAnalytics, ga4Events, goals, range }: MarketingSectionProps) {
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedEmailCampaigns, setSelectedEmailCampaigns] = useState<string[]>([]);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  // Extract unique campaigns from meta ads
  const campaigns: Campaign[] = useMemo(() => {
    const map = new Map<string, string>();
    adMetrics
      .filter((a) => a.source === "meta" && a.campaign_id)
      .forEach((a) => {
        if (!map.has(a.campaign_id)) {
          map.set(a.campaign_id, a.campaign_name || a.campaign_id);
        }
      });
    return Array.from(map.entries()).map(([campaign_id, campaign_name]) => ({
      campaign_id,
      campaign_name,
    }));
  }, [adMetrics]);

  // Extract unique email campaigns
  const emailCampaignOptions: Campaign[] = useMemo(() => {
    const map = new Map<string, string>();
    emailCampaigns.forEach((c) => {
      if (c.rd_campaign_id && !map.has(c.rd_campaign_id)) {
        map.set(c.rd_campaign_id, c.name || c.rd_campaign_id);
      }
    });
    return Array.from(map.entries()).map(([campaign_id, campaign_name]) => ({
      campaign_id,
      campaign_name,
    }));
  }, [emailCampaigns]);

  // Filtered email campaigns
  const filteredEmailCampaigns = useMemo(() => {
    if (selectedEmailCampaigns.length === 0) return emailCampaigns;
    return emailCampaigns.filter((c) => selectedEmailCampaigns.includes(c.rd_campaign_id));
  }, [emailCampaigns, selectedEmailCampaigns]);

  // Filtered meta metrics (apply campaign filter)
  const meta = useMemo(() => {
    const metaAll = adMetrics.filter((a) => a.source === "meta");
    if (selectedCampaigns.length === 0) return metaAll;
    return metaAll.filter((a) => selectedCampaigns.includes(a.campaign_id));
  }, [adMetrics, selectedCampaigns]);

  

  const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
  const avg = (arr: any[], key: string) => arr.length > 0 ? sum(arr, key) / arr.length : 0;

  // Build filtered adMetrics for charts (replace meta rows with filtered ones)
  const filteredAdMetrics = useMemo(() => {
    if (selectedCampaigns.length === 0) return adMetrics;
    const nonMeta = adMetrics.filter((a) => a.source !== "meta");
    return [...nonMeta, ...meta];
  }, [adMetrics, meta, selectedCampaigns]);

  // Site totals
  const siteTotals = useMemo(() => ({
    sessions: sum(siteAnalytics, "sessions"),
    users: sum(siteAnalytics, "users"),
    conversions: sum(siteAnalytics, "conversions"),
    pageviews: sum(siteAnalytics, "pageviews"),
  }), [siteAnalytics]);

  // Aggregate traffic_sources across all days in the period
  const aggregatedSources = useMemo(() => {
    const map = new Map<string, { sessions: number; conversions: number; totalEngTime: number; totalBounceRate: number; count: number }>();
    for (const day of siteAnalytics) {
      const sources = day.traffic_sources as any[] | null;
      if (!Array.isArray(sources)) continue;
      for (const s of sources) {
        const src = s.source || s.channel || "(unknown)";
        const existing = map.get(src) || { sessions: 0, conversions: 0, totalEngTime: 0, totalBounceRate: 0, count: 0 };
        existing.sessions += Number(s.sessions || 0);
        existing.conversions += Number(s.conversions || 0);
        existing.totalEngTime += Number(s.avg_engagement_time || 0);
        existing.totalBounceRate += Number(s.bounce_rate || 0);
        existing.count += 1;
        map.set(src, existing);
      }
    }
    return Array.from(map.entries()).map(([source, v]) => ({
      source,
      sessions: v.sessions,
      conversions: v.conversions,
      avg_engagement_time: v.count > 0 ? v.totalEngTime / v.count : 0,
      bounce_rate: v.count > 0 ? v.totalBounceRate / v.count : 0,
    }));
  }, [siteAnalytics]);

  // Email totals (use filtered)
  const emailTotals = useMemo(() => ({
    sent: filteredEmailCampaigns.length,
    totalSent: sum(filteredEmailCampaigns, "total_sent"),
    totalOpened: sum(filteredEmailCampaigns, "total_opened"),
    totalClicked: sum(filteredEmailCampaigns, "total_clicked"),
    openRate: avg(filteredEmailCampaigns, "open_rate") * 100,
    clickRate: avg(filteredEmailCampaigns, "click_rate") * 100,
  }), [filteredEmailCampaigns]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-semibold">Marketing</h2>
        <CampaignFilter
          campaigns={campaigns}
          selected={selectedCampaigns}
          onChange={setSelectedCampaigns}
        />
      </div>

      {/* Meta Ads */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Meta Ads</h3>
        {(() => {
          const totalImpressions = sum(meta, "impressions");
          const totalLinkClicks = sum(meta, "link_clicks");
          const totalSpend = sum(meta, "spend");
          const totalPurchases = sum(meta, "purchases");
          const uniqueCampaigns = new Set(meta.filter(m => m.campaign_id).map(m => m.campaign_id)).size;
          const cpc = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
          const ctr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
          const conversionRate = totalLinkClicks > 0 ? (totalPurchases / totalLinkClicks) * 100 : 0;

          return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Campanhas" value={uniqueCampaigns} icon={BarChart3} description="Campanhas ativas no período" />
              <MetricCard title="Impressões" value={totalImpressions} icon={Eye} goal={findGoal(goals, "meta_impressions", range)?.target_value} />
              <MetricCard title="Cliques no Link" value={totalLinkClicks} icon={MousePointerClick} goal={findGoal(goals, "meta_link_clicks", range)?.target_value} />
              <MetricCard title="CPC" value={`R$ ${cpc.toFixed(2)}`} icon={Wallet} description="Custo por clique no link" />
              <MetricCard title="CTR" value={`${ctr.toFixed(2)}%`} icon={BarChart3} description="Cliques no link / Impressões" />
              <MetricCard title="Compras (Pixel)" value={totalPurchases} icon={Target} goal={findGoal(goals, "meta_purchases", range)?.target_value} />
              <MetricCard title="Taxa de Conversão" value={`${conversionRate.toFixed(2)}%`} icon={Target} goal={findGoal(goals, "meta_conversion_rate", range)?.target_value} description="Compras / Cliques no link" />
            </div>
          );
        })()}
      </div>


      {/* RD Station */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">RD Station</h3>
          <CampaignFilter
            campaigns={emailCampaignOptions}
            selected={selectedEmailCampaigns}
            onChange={setSelectedEmailCampaigns}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Campanhas Enviadas" value={emailTotals.sent} icon={Mail} description={`${emailTotals.totalSent.toLocaleString("pt-BR")} leads alcançados`} />
          <MetricCard title="Taxa de Abertura" value={`${emailTotals.openRate.toFixed(1)}%`} icon={Mail} goal={findGoal(goals, "email_open_rate", range)?.target_value} />
          <MetricCard title="Taxa de Clique" value={`${emailTotals.clickRate.toFixed(1)}%`} icon={MousePointerClick} goal={findGoal(goals, "email_click_rate", range)?.target_value} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads Engajados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Abriram</span>
                  <span className="text-2xl font-bold">{emailTotals.totalOpened.toLocaleString("pt-BR")}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Clicaram</span>
                  <span className="text-2xl font-bold">{emailTotals.totalClicked.toLocaleString("pt-BR")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparador de Campanhas */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Comparar Campanhas</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {[{ value: compareA, setter: setCompareA, label: "Campanha A" }, { value: compareB, setter: setCompareB, label: "Campanha B" }].map(({ value, setter, label }) => {
              const campaign = value ? emailCampaigns.filter((c) => c.rd_campaign_id === value) : [];
              const data = campaign.length > 0
                ? {
                    name: campaign[0].name || value,
                    totalSent: campaign.reduce((s: number, c: any) => s + Number(c.total_sent || 0), 0),
                    totalOpened: campaign.reduce((s: number, c: any) => s + Number(c.total_opened || 0), 0),
                    totalClicked: campaign.reduce((s: number, c: any) => s + Number(c.total_clicked || 0), 0),
                    openRate: (campaign.reduce((s: number, c: any) => s + Number(c.open_rate || 0), 0) / campaign.length) * 100,
                    clickRate: (campaign.reduce((s: number, c: any) => s + Number(c.click_rate || 0), 0) / campaign.length) * 100,
                  }
                : null;

              return (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    <Select value={value ?? ""} onValueChange={(v) => setter(v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione uma campanha" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailCampaignOptions.map((opt) => (
                          <SelectItem key={opt.campaign_id} value={opt.campaign_id}>
                            {opt.campaign_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  {data && (
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Enviados</span>
                          <span className="text-2xl font-bold">{data.totalSent.toLocaleString("pt-BR")}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Abriram</span>
                          <div className="text-right">
                            <span className="text-2xl font-bold">{data.totalOpened.toLocaleString("pt-BR")}</span>
                            <span className="text-xs text-muted-foreground ml-1">({data.openRate.toFixed(1)}%)</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Clicaram</span>
                          <div className="text-right">
                            <span className="text-2xl font-bold">{data.totalClicked.toLocaleString("pt-BR")}</span>
                            <span className="text-xs text-muted-foreground ml-1">({data.clickRate.toFixed(1)}%)</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Site */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Site (Google Analytics)</h3>
        <div className="mb-4">
          <ConversionFunnelChart ga4Events={ga4Events} />
        </div>
        <div className="mb-4">
          <DemandGenTable ga4Events={ga4Events} />
        </div>
        <div className="mb-4">
          <DemandGenByDayChart ga4Events={ga4Events} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Sessões" value={siteTotals.sessions} icon={Globe} goal={findGoal(goals, "site_visits", range)?.target_value} />
          <MetricCard title="Usuários" value={siteTotals.users} icon={Users} description="Total de usuários" />
          <MetricCard title="Conversões" value={siteTotals.conversions} icon={Target} description="Key events do GA4" />
          <MetricCard title="Pageviews" value={siteTotals.pageviews} icon={FileText} description="Visualizações de página" />
        </div>
        {/* Source breakdown tables */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <SourceBreakdownTable title="Sessões por Origem" data={aggregatedSources} metricKey="sessions" />
          <SourceBreakdownTable title="Conversões por Origem" data={aggregatedSources} metricKey="conversions" />
          <SourceBreakdownTable
            title="Tempo Médio de Engajamento"
            data={aggregatedSources}
            metricKey="avg_engagement_time"
            formatValue={(v) => `${Math.round(v)}s`}
          />
          <SourceBreakdownTable
            title="Taxa de Rejeição"
            data={aggregatedSources}
            metricKey="bounce_rate"
            formatValue={(v) => `${(v * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ClicksByDayChart adMetrics={filteredAdMetrics} />
        <SessionsByDayChart siteAnalytics={siteAnalytics} />
      </div>
    </section>
  );
}
