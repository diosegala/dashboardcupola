import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/hooks/useEvent";
import { Button } from "@/components/ui/button";
import {
  Wallet, Eye, MousePointerClick, BarChart3, Target, MessageCircle, ShoppingCart, Crosshair,
  Mail, Users, Globe, FileText, Link2, Ticket as TicketIcon, Coins, TrendingUp,
} from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FunnelKPISection } from "@/components/dashboard/FunnelKPISection";
import { CampaignFilter, type Campaign } from "@/components/dashboard/CampaignFilter";
import { ClicksByDayChart } from "@/components/dashboard/charts/ClicksByDayChart";
import { SessionsByDayChart } from "@/components/dashboard/charts/SessionsByDayChart";
import { ConversionFunnelChart } from "@/components/dashboard/charts/ConversionFunnelChart";
import { DemandGenTable } from "@/components/dashboard/charts/DemandGenTable";
import { DemandGenByDayChart } from "@/components/dashboard/charts/DemandGenByDayChart";
import { SourceBreakdownTable } from "@/components/dashboard/SourceBreakdownTable";
import { SourceBreakdownDataTable } from "@/components/dashboard/SourceBreakdownDataTable";
import { SegmentCard, utmLabel } from "@/components/dashboard/CommercialSegments";
import { findGoal, type DateRange } from "@/hooks/useDashboardData";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf, batchOrder } from "@/lib/batches";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ChartLegend } from "@/components/dashboard/charts/ChartLegend";
import { useSeriesVisibility } from "@/components/dashboard/charts/chartSeries";
import { cn } from "@/lib/utils";

interface MarketingTabsProps {
  adMetrics: any[];
  emailCampaigns: any[];
  siteAnalytics: any[];
  ga4Events: any[];
  previousAdMetrics: any[];
  previousSiteAnalytics: any[];
  goals: any[];
  range: DateRange;
  // Vendas do período e do evento inteiro (o detalhe por lote usa o evento inteiro).
  tickets: Ticket[];
  allTickets: Ticket[];
}

const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number, casas = 0) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (n: number, casas = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

// Tabela simples dentro de card, com rolagem própria (a página nunca rola na horizontal).
function TableCard({ title, head, rows, rodape, actions }: { title: string; head: { label: string; right?: boolean }[]; rows: ReactNode[][]; rodape?: string | null; actions?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          {title} <InfoTip title={title} />
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  {head.map((h) => (
                    <th key={h.label} className={`py-2 pr-3 font-medium ${h.right ? "text-right" : "text-left"}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {r.map((c, j) => (
                      <td key={j} className={`py-2 pr-3 tabular-nums ${head[j]?.right ? "text-right" : "text-left"} ${j === 0 ? "font-medium" : ""}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rodape && <p className="mt-4 text-xs text-muted-foreground">{rodape}</p>}
      </CardContent>
    </Card>
  );
}

// Totais de uma lista de linhas de anúncio (Meta ou Google).
function adTotals(linhas: any[]) {
  const impressoes = sum(linhas, "impressions");
  const cliques = sum(linhas, "link_clicks") || sum(linhas, "clicks");
  const investimento = sum(linhas, "spend");
  const compras = sum(linhas, "purchases") || sum(linhas, "conversions");
  return {
    investimento, impressoes, cliques, compras,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpc: cliques > 0 ? investimento / cliques : 0,
    conversao: cliques > 0 ? (compras / cliques) * 100 : 0,
    custoCompra: compras > 0 ? investimento / compras : 0,
  };
}

// Uma linha por campanha, da que mais investiu para a que menos investiu.
function campaignRows(linhas: any[]) {
  const map = new Map<string, any[]>();
  linhas.forEach((l) => {
    const k = l.campaign_name || l.campaign_id || "Sem nome";
    map.set(k, [...(map.get(k) ?? []), l]);
  });
  return Array.from(map.entries())
    .map(([nome, ls]) => ({ nome, ...adTotals(ls) }))
    .sort((a, b) => b.investimento - a.investimento);
}

function campaignOptions(linhas: any[]): Campaign[] {
  const map = new Map<string, string>();
  linhas.forEach((a) => a.campaign_id && !map.has(a.campaign_id) && map.set(a.campaign_id, a.campaign_name || a.campaign_id));
  return Array.from(map.entries()).map(([campaign_id, campaign_name]) => ({ campaign_id, campaign_name }));
}

// Canal de divulgação a partir dos UTMs. Link da equipe (medium "timecupola") vira Equipe CUPOLA;
// RD Station e e-mail viram E-mail marketing. O resto fica como veio (Instagram, Whatsapp...).
function canalDe(t: Ticket): string {
  // Faturado interno é venda da equipe (regra do painel de vendas do Summit).
  if (t.source === "pipedrive") return "Equipe CUPOLA";
  const u = utmLabel(t.utm_source);
  if (!u) return t.coupon_code ? "Equipe CUPOLA" : "Sem link";
  const medium = (t.utm_medium ?? "").trim().toLowerCase();
  if (medium === "timecupola") return "Equipe CUPOLA";
  if (/^(rd[-\s]?station|rd|e-?mail.*)$/i.test(u) || medium === "email") return "E-mail marketing";
  return u;
}

// Ingressos e valor por canal, do maior para o menor.
function vendasPorCanal(pagantes: Ticket[]) {
  const map = new Map<string, { value: number; amount: number }>();
  pagantes.forEach((t) => {
    const k = canalDe(t);
    const c = map.get(k) ?? { value: 0, amount: 0 };
    map.set(k, { value: c.value + (t.quantity || 0), amount: c.amount + Number(t.total_price || 0) });
  });
  return Array.from(map.entries()).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value);
}

// ---------- Visão geral ----------
function Overview({ adMetrics, emailCampaigns, tickets, goals, range }: MarketingTabsProps) {
  const { paying } = useMemo(() => splitTickets(tickets), [tickets]);
  const canais = useMemo(() => vendasPorCanal(paying), [paying]);
  const midia = adTotals(adMetrics.filter((a) => a.source === "meta" || a.source === "google_ads"));
  const sympla = paying.filter((t) => t.source !== "pipedrive");
  const ingressosSympla = sympla.reduce((s, t) => s + (t.quantity || 0), 0);
  const comLink = sympla.filter((t) => utmLabel(t.utm_source)).reduce((s, t) => s + (t.quantity || 0), 0);
  const pagantes = paying.reduce((s, t) => s + (t.quantity || 0), 0);
  const receita = paying.reduce((s, t) => s + Number(t.total_price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Investimento em mídia" value={brl(midia.investimento, 2)} icon={Wallet} description="Meta Ads e Google Ads" />
        <MetricCard title="Investimento por ingresso" value={pagantes > 0 ? brl(midia.investimento / pagantes, 2) : "—"} icon={Coins} description={`Investimento dividido por ${int(pagantes)} ingressos pagantes`} />
        <MetricCard title="Receita por real investido" value={midia.investimento > 0 ? `${(receita / midia.investimento).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"} icon={TrendingUp} description={`${brl(receita)} em vendas no período`} />
        <MetricCard title="Vendas com link parametrizado" value={ingressosSympla > 0 ? pct((comLink / ingressosSympla) * 100, 0) : "—"} icon={Link2} description={`${int(comLink)} de ${int(ingressosSympla)} ingressos da Sympla têm UTM`} />
      </div>
      <FunnelKPISection adMetrics={adMetrics} emailCampaigns={emailCampaigns} tickets={tickets} goals={goals} range={range} />
      {canais.length > 0 && <SegmentCard title="Vendas por canal" items={canais} rodape="Equipe CUPOLA soma os links da equipe, os cupons sem link e os faturados internos. O detalhe de cada link está na aba Links." />}
    </div>
  );
}

// ---------- Mídia paga (Meta Ads e Google Ads usam o mesmo desenho) ----------
// O que é do Summit, em anúncios e e-mails: "summit", "[sum]", "[sum27]", "sum27" e variações, sem diferença de maiúsculas.
const DO_SUMMIT = /summit|\[\s*sum\s*\d*\s*\]|\bsum\s*\d{2}\b/i;
// Ano de edição escrito no nome ([SUM26], "SUM 26", "Summit 2026", "Summit 26"); null quando o nome não diz.
function edicaoNoNome(nome: string): string | null {
  const m = nome.match(/\[?\s*sum(?:mit)?\s*(?:20)?(\d{2})\b/i);
  return m ? m[1] : null;
}
function campanhasDoEvento(linhas: any[]) {
  const doEvento = linhas.filter((a) => DO_SUMMIT.test(a.campaign_name || ""));
  return doEvento.length ? doEvento : linhas;
}

function AdsTab({ fonte, adMetrics, previousAdMetrics, goals, range, foraAds = 0 }: MarketingTabsProps & { fonte: "meta" | "google_ads"; foraAds?: number }) {
  const todas = useMemo(() => adMetrics.filter((a) => a.source === fonte), [adMetrics, fonte]);
  const [sel, setSel] = useState<string[]>([]);
  const linhas = sel.length ? todas.filter((a) => sel.includes(a.campaign_id)) : todas;
  const t = adTotals(linhas);
  const ant = useMemo(() => {
    const p = previousAdMetrics.filter((a) => a.source === fonte);
    return sel.length || p.length === 0 ? null : adTotals(p);
  }, [previousAdMetrics, fonte, sel]);
  const ehMeta = fonte === "meta";
  const g = (k: string) => (ehMeta ? findGoal(goals, k, range) : null);
  const campanhas = campaignRows(linhas);
  const nome = ehMeta ? "Meta Ads" : "Google Ads";

  if (todas.length === 0) {
    return <Empty>Sem dados do {nome} no período. Se esperava ver dados aqui, confira a integração na página Integrações.</Empty>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <CampaignFilter campaigns={campaignOptions(todas)} selected={sel} onChange={setSel} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Investimento" value={t.investimento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} prefix="R$ " icon={Wallet} goal={g("meta_spend")} anterior={ant?.investimento} description={`${campanhas.length} campanhas no período`} />
        <MetricCard title="Impressões" value={t.impressoes} icon={Eye} goal={g("meta_impressions")} anterior={ant?.impressoes} />
        <MetricCard title="Cliques no Link" value={t.cliques} icon={MousePointerClick} goal={g("meta_link_clicks")} anterior={ant?.cliques} description={`CPC de ${brl(t.cpc, 2)}`} />
        <MetricCard title="CTR" value={pct(t.ctr, 2)} icon={BarChart3} goal={g("meta_ctr")} anterior={ant?.ctr} description="Cliques no link / Impressões" />
      </div>
      {/* Segunda linha: o que o clique virou. Meta tem 5 indicadores, Google 2; a grade se ajusta sem buraco. */}
      <div className={`grid gap-4 md:grid-cols-2 ${ehMeta ? "lg:grid-cols-5" : ""}`}>
        <MetricCard title={ehMeta ? "Compras (Pixel)" : "Conversões"} value={t.compras} icon={Target} goal={g("meta_purchases")} anterior={ant?.compras} description={t.compras > 0 ? `${brl(t.custoCompra, 2)} por ${ehMeta ? "compra" : "conversão"}` : undefined} />
        <MetricCard title="Taxa de Conversão" value={pct(t.conversao, 2)} icon={Target} goal={g("meta_conversion_rate")} anterior={ant?.conversao} description={ehMeta ? "Compras / Cliques no link" : "Conversões / Cliques"} />
        {ehMeta && (
          <>
            <MetricCard title="Mensagens" value={sum(linhas, "messages")} icon={MessageCircle} goal={g("meta_messages")} description="Conversas iniciadas via anúncio" />
            <MetricCard title="Adição de Carrinho" value={sum(linhas, "add_to_cart")} icon={ShoppingCart} goal={g("meta_add_to_cart")} description="Eventos add_to_cart do Pixel" />
            <MetricCard title="Remarketing Qualificado" value={sum(linhas, "remarketing_qualified")} icon={Crosshair} goal={g("meta_remarketing")} description="Conversão customizada" />
          </>
        )}
      </div>
      <ClicksByDayChart adMetrics={linhas} previousAdMetrics={sel.length ? [] : previousAdMetrics.filter((a) => a.source === fonte)} />
      <TableCard
        title="Desempenho por campanha"
        head={[{ label: "Campanha" }, { label: "Investimento", right: true }, { label: "Cliques", right: true }, { label: "CTR", right: true }, { label: "CPC", right: true }, { label: ehMeta ? "Compras" : "Conversões", right: true }, { label: "Custo por compra", right: true }]}
        rows={campanhas.map((c) => [c.nome, brl(c.investimento, 2), int(c.cliques), pct(c.ctr, 2), brl(c.cpc, 2), int(c.compras), c.compras > 0 ? brl(c.custoCompra, 2) : "—"])}
      />
    </div>
  );
}

// ---------- E-mail (RD Station) ----------
// A conta do RD Station tem e-mails de outros produtos da CUPOLA. Com algum do Summit no período, só eles contam
// (aqui e no Funil de KPIs).
function emailsDoEvento(todos: any[]) {
  const doEvento = todos.filter((c) => DO_SUMMIT.test(c.name || c.subject || ""));
  return doEvento.length ? doEvento : todos;
}

// Todos os e-mails da edição, do mais recente para o mais antigo, sem depender do período do painel:
// cada novo disparo entra no topo na próxima sincronização do RD Station.
function useEmailsDaEdicao() {
  const { event } = useEvent();
  const ano = event.name.match(/20(\d{2})/)?.[1];
  return useQuery({
    queryKey: ["email_campaigns_edicao", ano],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_campaigns").select("*").order("sent_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const doSummit = (data ?? []).filter((c) => DO_SUMMIT.test(c.name || c.subject || ""));
      // Fica fora só o que diz claramente ser de outra edição ([SUM26], "Summit 2026"); sem ano no nome, conta.
      return ano ? doSummit.filter((c) => { const e = edicaoNoNome(c.name || c.subject || ""); return !e || e === ano; }) : doSummit;
    },
  });
}

const POR_PAGINA = 10;
const COLUNAS_EMAIL = ["Enviados", "Entregues", "Bounce", "Abertura", "Clique", "Descadastros"];

// Nome do e-mail para leitura: sem a tag [SUM27] e sem palavras em caixa alta (LOTE ZERO vira Lote zero, TEASER vira Teaser).
// CUPOLA fica sempre em maiúsculas. O que já vem em minúsculas ou misto fica como está.
function nomeDoEmail(bruto: string) {
  const sem = bruto.replace(/^\[\s*sum\s*\d*\s*\]\s*[|:-]?\s*/i, "");
  const normal = sem.replace(/\p{L}{2,}/gu, (w) => (w.toUpperCase() === "CUPOLA" ? "CUPOLA" : w === w.toUpperCase() ? w.toLowerCase() : w));
  return normal.charAt(0).toUpperCase() + normal.slice(1);
}

// Gráfico iceberg dos e-mails: uma coluna por e-mail, em ordem de envio. Acima da linha o que foi bom (abertura e clique),
// abaixo o que pesou (descadastro e bounce). Mesmo estilo das barras do Comercial (Vendas por dia útil).
// Cada métrica é desenhada em relação ao maior valor dela no recorte (o maior vira 100), porque clique é bem menor
// que abertura; o tooltip mostra o valor real.
const METRICAS_EMAIL = [
  { chave: "abertura", titulo: "Abertura", cor: "hsl(var(--chart-2))", lado: 1, pilha: "a", casas: 1, resumo: "Maior abertura" },
  { chave: "clique", titulo: "Clique", cor: "hsl(var(--chart-3))", lado: 1, pilha: "b", casas: 2, resumo: "Maior clique" },
  { chave: "descadastro", titulo: "Descadastro", cor: "hsl(var(--bad))", lado: -1, pilha: "a", casas: 2, resumo: "Mais descadastro" },
  { chave: "bounce", titulo: "Bounce", cor: "hsl(var(--chart-5))", lado: -1, pilha: "b", casas: 2, resumo: "Mais bounce" },
] as const;
type ChaveEmail = (typeof METRICAS_EMAIL)[number]["chave"];
type LinhaEmail = Record<ChaveEmail, number> & { id: string; nome: string; data: string; quando: string; ent: number };
const ULTIMOS = 10;

function EmailCompareChart({ emails }: { emails: any[] }) {
  const todas = useMemo(
    () =>
      emails
        .filter((c) => Number(c.total_delivered || 0) > 0)
        .map((c): LinhaEmail => {
          const ent = Number(c.total_delivered || 0);
          const env = Number(c.total_sent || 0) || ent;
          return {
            id: String(c.id),
            nome: nomeDoEmail(String(c.name || c.subject || c.rd_campaign_id)),
            data: c.sent_at ? new Date(c.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "",
            quando: String(c.sent_at ?? ""),
            ent,
            abertura: (Number(c.total_opened || 0) / ent) * 100,
            clique: (Number(c.total_clicked || 0) / ent) * 100,
            descadastro: (Number(c.unsubscribes || 0) / ent) * 100,
            bounce: (Number(c.total_bounced || 0) / env) * 100,
          };
        })
        .sort((a, b) => a.quando.localeCompare(b.quando)),
    [emails],
  );
  const [modo, setModo] = useState<"ultimos" | "todos">("ultimos");
  const series = useSeriesVisibility();
  const aguardando = emails.filter((c) => Number(c.total_sent || 0) > 0 && !Number(c.total_delivered || 0)).length;
  const linhas = modo === "todos" ? todas : todas.slice(-ULTIMOS);

  const { dados, lideres } = useMemo(() => {
    const max = Object.fromEntries(METRICAS_EMAIL.map((m) => [m.chave, Math.max(...linhas.map((l) => l[m.chave]), 0) || 1])) as Record<ChaveEmail, number>;
    const lideres = METRICAS_EMAIL.map((m) => ({ m, l: linhas.reduce((a, b) => (b[m.chave] > a[m.chave] ? b : a), linhas[0]) }));
    const dados = linhas.map((l) => ({
      ...l,
      ...Object.fromEntries(METRICAS_EMAIL.map((m) => [`i_${m.chave}`, (l[m.chave] / max[m.chave]) * 100 * m.lado])),
    }));
    return { dados, lideres };
  }, [linhas]);

  if (todas.length < 2) return <p className="py-10 text-center text-sm text-muted-foreground">É preciso ao menos 2 e-mails com relatório de entrega para comparar.</p>;

  const botao = (m: "ultimos" | "todos", rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150", modo === m ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
    >
      {rotulo}
    </button>
  );
  // Cada e-mail ganha ao menos 56 px: com dezenas, o gráfico desliza para o lado dentro do card.
  const largura = Math.max(dados.length * 56, 320);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {todas.length > ULTIMOS ? (
          <div className="inline-flex items-center gap-0.5 rounded-full border bg-secondary p-1">
            {botao("ultimos", `Últimos ${ULTIMOS}`)}
            {botao("todos", `Todos (${todas.length})`)}
          </div>
        ) : <span />}
        <div className="flex items-center gap-1">
          <ChartLegend
            items={METRICAS_EMAIL.map((m) => ({ key: `i_${m.chave}`, label: m.titulo, color: m.cor, shape: "square" as const }))}
            hidden={series.hidden}
            onToggle={series.toggle}
            onFocus={series.setFocused}
          />
          <InfoTip
            title="Como ler o gráfico"
            text={`Uma coluna por e-mail, em ordem de envio. Acima da linha, o que foi bom: abertura e clique, sobre os entregues. Abaixo, o que pesou: descadastro, sobre os entregues, e bounce, sobre os enviados. Cada métrica é comparada com o maior valor dela entre os e-mails mostrados, por isso clique e abertura cabem lado a lado. Passe o mouse numa coluna para ver os números reais.${aguardando > 0 ? ` ${aguardando} e-mail ainda sem relatório de entrega do RD não entra.` : ""}`}
          />
        </div>
      </div>

      {/* Leitura rápida: quem foi o destaque de cada métrica. */}
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {lideres.map(({ m, l }) => (
          <div key={m.chave} className="rounded-2xl border bg-secondary/40 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: m.cor }} />
              {m.resumo}
            </p>
            <p className="text-lg font-semibold leading-tight tracking-[-0.02em] tabular-nums">{pct(l[m.chave], m.casas)}</p>
            <p className="truncate text-[11px] text-muted-foreground" title={l.nome}>{l.data} · {l.nome}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: largura }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados} stackOffset="sign" margin={{ left: 0, right: 8, top: 12, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} horizontal={false} />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} className="fill-muted-foreground" />
              <YAxis hide domain={[-100, 100]} />
              <ReferenceLine y={0} stroke="hsl(var(--line-strong))" />
              <Tooltip
                cursor={{ fill: "hsl(var(--secondary))" }}
                content={({ active, payload }) => {
                  const l = active && payload?.[0]?.payload as LinhaEmail | undefined;
                  if (!l) return null;
                  return (
                    <div className="max-w-[260px] rounded-[10px] border border-line-strong bg-card px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold leading-snug">{l.nome}</p>
                      <p className="mb-1.5 text-muted-foreground">{l.data} · {int(l.ent)} entregues</p>
                      {METRICAS_EMAIL.map((m) => (
                        <p key={m.chave} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: m.cor }} />{m.titulo}</span>
                          <span className="tabular-nums">{pct(l[m.chave], m.casas)}</span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {METRICAS_EMAIL.map((m) => (
                <Bar
                  key={m.chave}
                  dataKey={`i_${m.chave}`}
                  name={m.titulo}
                  stackId={m.pilha}
                  fill={m.cor}
                  fillOpacity={series.opacity(`i_${m.chave}`)}
                  hide={series.hidden.has(`i_${m.chave}`)}
                  radius={m.lado > 0 ? [5, 5, 0, 0] : [0, 0, 5, 5]}
                  maxBarSize={22}
                  animationDuration={900}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function EmailList({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? data : data.slice(0, POR_PAGINA);

  return (
    <div>
      <div className="pb-3">
        <p className="text-xs text-muted-foreground">{isLoading ? "Carregando…" : `${data.length} e-mails desta edição, do mais recente para o mais antigo. Não depende do período escolhido.`}</p>
      </div>
      <div>
        {/* Tela larga: linha com colunas. Tela menor: cada e-mail vira um bloco com os números embaixo do nome. Nada corta. */}
        <div className="hidden items-center gap-2 border-b pb-2 text-xs text-muted-foreground xl:flex">
          <span className="flex-1">E-mail</span>
          {COLUNAS_EMAIL.map((c) => <span key={c} className="w-[84px] shrink-0 text-right">{c}</span>)}
        </div>
        {visiveis.map((c) => {
          const ent = Number(c.total_delivered || 0);
          const env = Number(c.total_sent || 0);
          const aguardando = env > 0 && ent === 0;
          const nome = nomeDoEmail(String(c.name || c.subject || c.rd_campaign_id));
          const valores: ReactNode[] = [
            int(env),
            aguardando ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Aguardando<InfoTip title="Aguardando" text="Disparo recente: o RD Station ainda não mandou o relatório de entrega. Atualiza sozinho na próxima sincronização." /></span> : int(ent),
            int(Number(c.total_bounced || 0)),
            ent > 0 ? pct((Number(c.total_opened || 0) / ent) * 100) : "—",
            ent > 0 ? pct((Number(c.total_clicked || 0) / ent) * 100) : "—",
            int(Number(c.unsubscribes || 0)),
          ];
          return (
            <div key={c.id} className="flex flex-col gap-3 border-b border-border/60 py-3 text-sm last:border-0 hover:bg-muted/40 xl:flex-row xl:items-center xl:gap-2">
              <div className="min-w-0 xl:flex-1 xl:pr-2">
                <p className="line-clamp-2 font-medium leading-snug" title={c.name || ""}>{nome}</p>
                <p className="text-xs text-muted-foreground">{c.sent_at ? new Date(c.sent_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }) : "Sem data de envio"}</p>
              </div>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6 xl:contents">
                {valores.map((v, i) => (
                  <div key={COLUNAS_EMAIL[i]} className="xl:w-[84px] xl:shrink-0 xl:text-right">
                    <dt className="text-[11px] text-muted-foreground xl:hidden">{COLUNAS_EMAIL[i]}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
        {data.length > POR_PAGINA && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setTodos((v) => !v)}>{todos ? "Mostrar menos" : `Ver todos os ${data.length}`}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// E-mails enviados: um card, duas visões dos mesmos e-mails da edição. Gráfico para bater o olho, lista para os números.
function EmailsCard() {
  const { data = [], isLoading } = useEmailsDaEdicao();
  const [visao, setVisao] = useState("grafico");
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">E-mails enviados <InfoTip title="E-mails enviados" /></CardTitle>
        <Tabs value={visao} onValueChange={setVisao}>
          <SlidingTabsList value={visao} className="h-9">
            {[["grafico", "Gráfico"], ["lista", "Lista"]].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="relative z-[1] px-4 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">{l}</TabsTrigger>
            ))}
          </SlidingTabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="animate-panel-in" key={visao}>
        {visao === "grafico" ? <EmailCompareChart emails={data} /> : <EmailList data={data} isLoading={isLoading} />}
      </CardContent>
    </Card>
  );
}

function EmailTab({ emailCampaigns, foraDoEvento, goals, range }: MarketingTabsProps & { foraDoEvento: number }) {
  const [sel, setSel] = useState<string[]>([]);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const opcoes = useMemo(() => {
    const map = new Map<string, string>();
    [...emailCampaigns].sort((x, y) => String(y.sent_at ?? "").localeCompare(String(x.sent_at ?? ""))).forEach((c) => c.rd_campaign_id && !map.has(c.rd_campaign_id) && map.set(c.rd_campaign_id, nomeDoEmail(String(c.name || c.subject || c.rd_campaign_id))));
    return Array.from(map.entries()).map(([campaign_id, campaign_name]) => ({ campaign_id, campaign_name }));
  }, [emailCampaigns]);
  const lista = sel.length ? emailCampaigns.filter((c) => sel.includes(c.rd_campaign_id)) : emailCampaigns;
  const enviados = sum(lista, "total_sent");
  const entregues = sum(lista, "total_delivered");
  const abriram = sum(lista, "total_opened");
  const clicaram = sum(lista, "total_clicked");
  // Taxas pelo total (quem abriu / quem recebeu), não pela média das campanhas: campanha pequena não distorce.
  const abertura = entregues > 0 ? (abriram / entregues) * 100 : 0;
  const clique = entregues > 0 ? (clicaram / entregues) * 100 : 0;
  const descadastros = sum(lista, "unsubscribes");
  // Enviado não é entregue: do total enviado, parte volta (bounce), parte o RD descarta antes de enviar
  // (contato inválido ou descadastrado) e, num disparo recente, parte ainda não tem retorno.
  const bounce = sum(lista, "total_bounced");
  const descartados = sum(lista, "total_dropped");
  // Disparo com 0 entregues ainda não tem o relatório de entrega do RD (chega horas depois): conta inteiro como sem retorno.
  const pendentes = lista.filter((c) => Number(c.total_sent || 0) > 0 && !Number(c.total_delivered || 0));
  const semRetorno = Math.max(0, enviados - entregues - bounce - descartados);
  const comRetorno = enviados - sum(pendentes, "total_sent");
  const entrega = comRetorno > 0 ? (entregues / comRetorno) * 100 : 0;
  const partesEntrega = [
    { label: "Entregues", value: entregues, cor: "bg-ok", info: "Chegaram na caixa de entrada. A taxa de entrega divide os entregues pelos enviados que já têm retorno do RD." },
    { label: "Bounce", value: bounce, cor: "bg-warn", info: "Voltaram no envio: endereço inexistente, domínio inválido ou caixa cheia. O RD não separa bounce definitivo de temporário neste relatório." },
    { label: "Descartados", value: descartados, cor: "bg-bad", info: "Contatos que o RD já inativou, depois de um bounce definitivo ou de vários temporários. Por isso nem recebem o envio." },
    { label: "Ainda sem retorno", value: semRetorno, cor: "bg-muted-foreground/30", info: "Disparo recente: o RD ainda não mandou o relatório de entrega. Atualiza sozinho na próxima sincronização." },
  ];

  if (emailCampaigns.length === 0) return <Empty>Nenhum e-mail enviado pelo RD Station no período.</Empty>;

  const linhaCampanha = (id: string | null) => {
    const c = id ? emailCampaigns.filter((x) => x.rd_campaign_id === id) : [];
    if (!c.length) return null;
    const ent = sum(c, "total_delivered");
    return { ent, abr: sum(c, "total_opened"), cli: sum(c, "total_clicked"), bou: sum(c, "total_bounced") };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <CampaignFilter campaigns={opcoes} selected={sel} onChange={setSel} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Campanhas Enviadas" value={lista.length} icon={Mail} goal={findGoal(goals, "email_sent", range)} description={`${int(enviados)} e-mails enviados no total`} />
        <MetricCard title="Taxa de Entrega" value={comRetorno > 0 ? pct(entrega) : "—"} icon={Mail} description={`${int(entregues)} entregues de ${int(comRetorno)} com retorno`} />
        <MetricCard title="Taxa de Abertura" value={pct(abertura)} icon={Mail} goal={findGoal(goals, "email_open_rate", range)} description={`${int(abriram)} pessoas abriram`} />
        <MetricCard title="Taxa de Clique" value={pct(clique)} icon={MousePointerClick} goal={findGoal(goals, "email_click_rate", range)} description={`${int(clicaram)} pessoas clicaram`} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">Entrega dos e-mails <InfoTip title="Entrega dos e-mails" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
            {partesEntrega.map((p) => (enviados > 0 && p.value > 0 ? <div key={p.label} className={p.cor} style={{ width: `${(p.value / enviados) * 100}%` }} /> : null))}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-xs text-muted-foreground">Enviados</dt>
              <dd className="text-lg font-semibold tabular-nums">{int(enviados)}</dd>
            </div>
            {partesEntrega.map((p) => (
              <div key={p.label}>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className={`inline-block h-2 w-2 rounded-full ${p.cor}`} />{p.label}<InfoTip title={p.label} text={p.info} /></dt>
                <dd className="text-lg font-semibold tabular-nums">{int(p.value)} <span className="text-xs font-normal text-muted-foreground">{enviados > 0 ? pct((p.value / enviados) * 100) : ""}</span></dd>
              </div>
            ))}
          </dl>
          {/* Depois da entrega: quem recebeu e saiu da lista. É diferente de bounce e descarte, que são problemas de entrega. */}
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Receberam e saíram da lista</p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">Descadastros<InfoTip title="Descadastros" text="Pessoas que receberam o e-mail e pediram para sair da lista. Não é problema de entrega." /></dt>
                <dd className="text-lg font-semibold tabular-nums">{int(descadastros)} <span className="text-xs font-normal text-muted-foreground">{entregues > 0 ? pct((descadastros / entregues) * 100, 2) : ""}</span></dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">Marcaram como spam<InfoTip title="Marcaram como spam" text="Pessoas que receberam e marcaram o e-mail como spam. Muitos casos prejudicam a entrega dos próximos envios." /></dt>
                <dd className="text-lg font-semibold tabular-nums">{int(sum(lista, "spam_reported"))} <span className="text-xs font-normal text-muted-foreground">{entregues > 0 ? pct((sum(lista, "spam_reported") / entregues) * 100, 2) : ""}</span></dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
      <EmailsCard />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">Comparar dois e-mails <InfoTip title="Comparar dois e-mails" /></CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[{ v: a, set: setA, label: "E-mail A" }, { v: b, set: setB, label: "E-mail B" }].map(({ v, set, label }) => {
            const d = linhaCampanha(v);
            return (
              <div key={label} className="rounded-2xl border p-4">
                <Select value={v ?? ""} onValueChange={set}>
                  <SelectTrigger><SelectValue placeholder={`Escolha o ${label}`} /></SelectTrigger>
                  <SelectContent>
                    {opcoes.map((o) => <SelectItem key={o.campaign_id} value={o.campaign_id}>{o.campaign_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {d && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <dt className="text-muted-foreground">Entregues</dt><dd className="text-right font-semibold tabular-nums">{int(d.ent)}</dd>
                    <dt className="text-muted-foreground">Abriram</dt><dd className="text-right font-semibold tabular-nums">{int(d.abr)} <span className="text-xs font-normal text-muted-foreground">({d.ent ? pct((d.abr / d.ent) * 100) : "—"})</span></dd>
                    <dt className="text-muted-foreground">Clicaram</dt><dd className="text-right font-semibold tabular-nums">{int(d.cli)} <span className="text-xs font-normal text-muted-foreground">({d.ent ? pct((d.cli / d.ent) * 100) : "—"})</span></dd>
                    <dt className="text-muted-foreground">Bounce</dt><dd className="text-right font-semibold tabular-nums">{int(d.bou)}</dd>
                  </dl>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Site (Google Analytics) ----------
function SiteTab({ siteAnalytics, previousSiteAnalytics, ga4Events, goals, range }: MarketingTabsProps) {
  const fontes = useMemo(() => {
    const map = new Map<string, { sessions: number; conversions: number; eng: number; bounce: number; n: number }>();
    for (const dia of siteAnalytics) {
      const lista = dia.traffic_sources as any[] | null;
      if (!Array.isArray(lista)) continue;
      for (const s of lista) {
        const k = s.source || s.channel || "(sem origem)";
        const e = map.get(k) ?? { sessions: 0, conversions: 0, eng: 0, bounce: 0, n: 0 };
        e.sessions += Number(s.sessions || 0);
        e.conversions += Number(s.conversions || 0);
        e.eng += Number(s.avg_engagement_time || 0);
        e.bounce += Number(s.bounce_rate || 0);
        e.n += 1;
        map.set(k, e);
      }
    }
    return Array.from(map.entries()).map(([source, v]) => ({ source, sessions: v.sessions, conversions: v.conversions, avg_engagement_time: v.n ? v.eng / v.n : 0, bounce_rate: v.n ? v.bounce / v.n : 0 }));
  }, [siteAnalytics]);
  const ant = previousSiteAnalytics.length ? { s: sum(previousSiteAnalytics, "sessions"), u: sum(previousSiteAnalytics, "users"), c: sum(previousSiteAnalytics, "conversions"), p: sum(previousSiteAnalytics, "pageviews") } : null;

  if (siteAnalytics.length === 0 && ga4Events.length === 0) return <Empty>Sem dados do Google Analytics no período.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Sessões" value={sum(siteAnalytics, "sessions")} icon={Globe} goal={findGoal(goals, "site_visits", range)} anterior={ant?.s} />
        <MetricCard title="Usuários" value={sum(siteAnalytics, "users")} icon={Users} goal={findGoal(goals, "site_users", range)} anterior={ant?.u} description="Total de usuários" />
        <MetricCard title="Conversões" value={sum(siteAnalytics, "conversions")} icon={Target} goal={findGoal(goals, "site_conversions", range)} anterior={ant?.c} description="Key events do GA4" />
        <MetricCard title="Pageviews" value={sum(siteAnalytics, "pageviews")} icon={FileText} goal={findGoal(goals, "site_pageviews", range)} anterior={ant?.p} description="Visualizações de página" />
      </div>
      <ConversionFunnelChart ga4Events={ga4Events} />
      <SessionsByDayChart siteAnalytics={siteAnalytics} previousSiteAnalytics={previousSiteAnalytics} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SourceBreakdownTable title="Sessões por Origem" data={fontes} metricKey="sessions" />
        <SourceBreakdownTable title="Conversões por Origem" data={fontes} metricKey="conversions" />
        <SourceBreakdownDataTable title="Tempo Médio de Engajamento" data={fontes} metricKey="avg_engagement_time" formatValue={(v) => `${Math.round(v)}s`} />
        <SourceBreakdownDataTable title="Taxa de Rejeição" data={fontes} metricKey="bounce_rate" formatValue={(v) => `${(v * 100).toFixed(1)}%`} />
      </div>
      <DemandGenTable ga4Events={ga4Events} />
      <DemandGenByDayChart ga4Events={ga4Events} />
    </div>
  );
}

// ---------- Links e UTMs ----------
const PERIODO = "periodo";

const EVENTO = "evento";

function LinksTab({ tickets, allTickets, goals }: MarketingTabsProps) {
  const lotes = useMemo(() => {
    const s = new Set<string>();
    allTickets.forEach((t) => {
      const l = batchOf(t.ticket_type);
      if (l) s.add(l);
    });
    return Array.from(s).sort((x, y) => batchOrder(x) - batchOrder(y));
  }, [allTickets]);
  const [recorte, setRecorte] = useState(PERIODO);

  // Vendas por canal somam Sympla e faturados (faturado conta para a Equipe CUPOLA); os links e a cobertura de UTM são só Sympla.
  const base = recorte === PERIODO ? tickets : recorte === EVENTO ? allTickets : allTickets.filter((t) => batchOf(t.ticket_type) === recorte);
  const { paying } = splitTickets(base);
  const sympla = paying.filter((t) => t.source !== "pipedrive");
  const totalSympla = sympla.reduce((s, t) => s + (t.quantity || 0), 0);
  const total = paying.reduce((s, t) => s + (t.quantity || 0), 0);

  // Metas por canal (página Metas › Canais de venda): a do lote escolhido ou, no evento todo, a soma dos lotes.
  const metaDe = (canal: string): number | null => {
    if (recorte === PERIODO) return null;
    const doCanal = goals.filter((g) => g.metric_key === "channel_sales" && (g.quota_key ?? "").trim().toLowerCase() === canal.toLowerCase() && (recorte === EVENTO || g.ticket_type === recorte));
    return doCanal.length ? doCanal.reduce((s, g) => s + Number(g.target_value || 0), 0) : null;
  };
  const temMetas = goals.some((g) => g.metric_key === "channel_sales");

  const porCanal = new Map<string, { q: number; v: number }>();
  paying.forEach((t) => {
    const k = canalDe(t);
    const c = porCanal.get(k) ?? { q: 0, v: 0 };
    porCanal.set(k, { q: c.q + (t.quantity || 0), v: c.v + Number(t.total_price || 0) });
  });
  // Canal com meta e ainda sem venda também aparece.
  if (recorte !== PERIODO) {
    goals
      .filter((g) => g.metric_key === "channel_sales" && g.quota_key && (recorte === EVENTO || g.ticket_type === recorte))
      .forEach((g) => {
        const nome = String(g.quota_key).trim();
        if (![...porCanal.keys()].some((k) => k.toLowerCase() === nome.toLowerCase())) porCanal.set(nome, { q: 0, v: 0 });
      });
  }
  const canais = Array.from(porCanal.entries()).sort((a, b) => b[1].q - a[1].q);

  const porLink = new Map<string, { canal: string; source: string; medium: string; campaign: string; q: number; v: number }>();
  sympla.forEach((t) => {
    if (!utmLabel(t.utm_source)) return;
    const canal = canalDe(t);
    const src = (t.utm_source ?? "").trim();
    const med = (t.utm_medium ?? "").trim() || "—";
    const camp = (t.utm_campaign ?? "").trim() || "—";
    const k = `${canal}|${src}|${med}|${camp}`;
    const l = porLink.get(k) ?? { canal, source: src, medium: med, campaign: camp, q: 0, v: 0 };
    porLink.set(k, { ...l, q: l.q + (t.quantity || 0), v: l.v + Number(t.total_price || 0) });
  });
  const links = Array.from(porLink.values()).sort((a, b) => b.q - a.q);
  const comLink = links.reduce((s, l) => s + l.q, 0);

  const nomeRecorte = recorte === PERIODO ? "no período" : recorte === EVENTO ? "no evento todo" : `no ${recorte}`;
  const seletor = (
    <Select value={recorte} onValueChange={setRecorte}>
      <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={PERIODO}>Período escolhido</SelectItem>
        {lotes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        <SelectItem value={EVENTO}>Evento todo</SelectItem>
      </SelectContent>
    </Select>
  );
  const comMeta = recorte !== PERIODO && temMetas;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Ingressos pagantes" value={total} icon={TicketIcon} description={`Sympla e faturados ${nomeRecorte}`} />
        <MetricCard title="Com link parametrizado" value={totalSympla ? pct((comLink / totalSympla) * 100, 0) : "—"} icon={Link2} description={`${int(comLink)} de ${int(totalSympla)} ingressos da Sympla têm UTM`} />
        <MetricCard title="Canais com venda" value={canais.filter(([k, c]) => k !== "Sem link" && c.q > 0).length} icon={BarChart3} />
      </div>
      <TableCard
        title="Vendas por canal"
        actions={seletor}
        head={comMeta
          ? [{ label: "Canal" }, { label: "Vendidos", right: true }, { label: "Meta", right: true }, { label: "% da meta", right: true }, { label: "Falta", right: true }, { label: "Valor", right: true }]
          : [{ label: "Canal" }, { label: "Ingressos", right: true }, { label: "% do total", right: true }, { label: "Valor", right: true }]}
        rows={canais.map(([k, c]) => {
          if (!comMeta) return [k, int(c.q), total ? pct((c.q / total) * 100, 0) : "—", brl(c.v)];
          const m = metaDe(k);
          const p = m ? (c.q / m) * 100 : null;
          return [
            k,
            int(c.q),
            m != null ? int(m) : "—",
            p != null ? <span className={p >= 100 ? "font-semibold text-ok" : ""}>{pct(p, 0)}</span> : "—",
            m != null ? (c.q >= m ? <span className="text-ok">Bateu</span> : int(m - c.q)) : "—",
            brl(c.v),
          ];
        })}
        rodape={
          recorte === PERIODO
            ? "Escolha um lote ou Evento todo para comparar cada canal com a meta (cadastrada em Metas › Canais de venda)."
            : temMetas
              ? "Metas cadastradas em Metas › Canais de venda. Em Evento todo, as metas dos lotes somam."
              : "Nenhuma meta por canal cadastrada ainda. Cadastre em Metas › Canais de venda para ver meta, % e quanto falta."
        }
      />
      <TableCard
        title="Por link parametrizado"
        head={[{ label: "Canal" }, { label: "Source" }, { label: "Medium" }, { label: "Campanha" }, { label: "Ingressos", right: true }, { label: "Valor", right: true }]}
        rows={links.map((l) => [l.canal, l.source, l.medium, l.campaign, int(l.q), brl(l.v)])}
        rodape="Só vendas da Sympla: faturado interno não passa por link."
      />
    </div>
  );
}

const ABAS = [
  { v: "geral", l: "Geral" },
  { v: "meta", l: "Meta Ads" },
  { v: "google", l: "Google Ads" },
  { v: "email", l: "E-mail" },
  { v: "site", l: "Site" },
  { v: "links", l: "Links" },
];

let abaLembrada = "geral";

// Marketing em abas, uma por sistema, sempre com a mesma ordem: números do topo, gráfico, detalhe.
export function MarketingTabs(todasProps: MarketingTabsProps) {
  const emails = useMemo(() => emailsDoEvento(todasProps.emailCampaigns), [todasProps.emailCampaigns]);
  // A conta de anúncios também tem campanhas de outros produtos (ex.: Reforma tributária). Com "Summit" no nome de alguma,
  // só essas contam, em todas as abas e no funil.
  const ads = useMemo(() => campanhasDoEvento(todasProps.adMetrics), [todasProps.adMetrics]);
  const adsAnteriores = useMemo(() => campanhasDoEvento(todasProps.previousAdMetrics), [todasProps.previousAdMetrics]);
  const foraAds = new Set(todasProps.adMetrics.filter((a) => !ads.includes(a)).map((a) => a.campaign_id)).size;
  const props = { ...todasProps, emailCampaigns: emails, adMetrics: ads, previousAdMetrics: adsAnteriores, foraAds };
  const temGoogle = props.adMetrics.some((a) => a.source === "google_ads");
  const abas = ABAS.filter((a) => a.v !== "google" || temGoogle);
  const [aba, setAbaState] = useState(abas.some((a) => a.v === abaLembrada) ? abaLembrada : "geral");
  const setAba = (v: string) => {
    abaLembrada = v;
    setAbaState(v);
  };

  return (
    <Tabs value={aba} onValueChange={setAba}>
      {/* Em tela larga, abas em pílula; no celular, uma lista de escolha (nenhum nome fica cortado). */}
      <div className="mb-5 hidden sm:block">
        <SlidingTabsList value={aba}>
          {abas.map(({ v, l }) => (
            <TabsTrigger key={v} value={v} className="relative z-[1] data-[state=active]:bg-transparent data-[state=active]:text-background">
              {l}
            </TabsTrigger>
          ))}
        </SlidingTabsList>
      </div>
      <div className="mb-5 sm:hidden">
        <Select value={aba} onValueChange={setAba}>
          <SelectTrigger className="h-11 rounded-full font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent>
            {abas.map(({ v, l }) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <TabsContent value="geral" className="mt-0 animate-panel-in"><Overview {...props} /></TabsContent>
      <TabsContent value="meta" className="mt-0 animate-panel-in"><AdsTab fonte="meta" {...props} /></TabsContent>
      {temGoogle && <TabsContent value="google" className="mt-0 animate-panel-in"><AdsTab fonte="google_ads" {...props} /></TabsContent>}
      <TabsContent value="email" className="mt-0 animate-panel-in"><EmailTab {...props} foraDoEvento={todasProps.emailCampaigns.length - emails.length} /></TabsContent>
      <TabsContent value="site" className="mt-0 animate-panel-in"><SiteTab {...props} /></TabsContent>
      <TabsContent value="links" className="mt-0 animate-panel-in"><LinksTab {...props} /></TabsContent>
    </Tabs>
  );
}
