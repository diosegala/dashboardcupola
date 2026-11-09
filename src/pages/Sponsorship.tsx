import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Chip } from "@/components/Chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/InfoTip";
import { CompareProvider } from "@/hooks/useCompare";
import { CompareToggle } from "@/components/CompareToggle";
import { goalsOfEvent, isEventClosed, useEvent } from "@/hooks/useEvent";
import { useAuth } from "@/hooks/useAuth";
import { useGoals } from "@/hooks/useDashboardData";
import { useReadCrmAccount, useSaveSponsorshipConfig, useSponsorCoupons, useSponsorshipConfig, useSponsorshipData, useSponsorshipHistory, useValueHistory } from "@/hooks/useSponsorship";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { eventGoal } from "@/lib/goalMetrics";
import { EMPTY_DRAFT, FEATURES, HIDDEN_INFO_KEYS, channelGroup, isEventProduct, visibleInfoFields, mappingFromCrm, quotaOfProduct, quotasFromCatalog, type SponsorshipDraft } from "@/lib/sponsorship";
import {
  EXAMPLE_GOALS,
  SPONSOR_GOAL_KEYS,
  addDays,
  computeSponsorship,
  sponsorDeals,
  exampleDataset,
  examplePrevious,
  quotaBreakdown,
  saoPauloDate,
  weeklySeries,
  type DealRow,
  type SponsorshipGoals,
} from "@/lib/sponsorshipMetrics";
import {
  addonItems,
  deliveries,
  eventShare,
  historyCurve,
  renewalsFromHistory,
  valueEvolution,
  documentType,
  fieldStatuses,
  fieldText,
  previousCurve,
  prospecting,
  rawField,
  receipts,
  renewals,
  type OrgRow,
} from "@/lib/sponsorshipExtra";
import { SponsorRevenueCard } from "@/components/sponsorship/SponsorRevenueCard";
import { SponsorQuotasCard } from "@/components/sponsorship/SponsorQuotasCard";
import { SponsorOwnersCard } from "@/components/sponsorship/SponsorOwnersCard";
import { SponsorPaceCard } from "@/components/sponsorship/SponsorPaceCard";
import { type SalesColumn } from "@/components/sponsorship/SponsorSalesCard";
import { SponsorProspectCard } from "@/components/sponsorship/SponsorProspectCard";
import { SponsorRenewalCard } from "@/components/sponsorship/SponsorRenewalCard";
import { SponsorReceiptsCard } from "@/components/sponsorship/SponsorReceiptsCard";
import { SponsorDeliveriesCard } from "@/components/sponsorship/SponsorDeliveriesCard";
import { SponsorAddonsCard } from "@/components/sponsorship/SponsorAddonsCard";
import { CrmWarning } from "@/components/sponsorship/parts";

const goalValue = (goals: any[], key: string) => {
  const g = eventGoal(goals, key);
  const v = g ? Number(g.target_value) : 0;
  return v > 0 ? v : null;
};

// Colunas da lista de Vendas que vêm de campos do CRM (aparecem só quando o campo existe).
const SALES_FIELD_COLUMNS: { key: string; label: string; info: string }[] = [
  { key: "payment_method", label: "Pagamento", info: "Forma de pagamento do negócio no Pipedrive." },
  { key: "installments_count", label: "Parcelas", info: "Número de parcelas do negócio no Pipedrive." },
  { key: "first_due_date", label: "1º vencimento", info: "Data da primeira parcela." },
  { key: "contract_status", label: "Contrato", info: "Status do contrato no Pipedrive." },
  { key: "payment_status", label: "Status do pagamento", info: "Se o patrocinador já pagou." },
  { key: "signing_date", label: "Assinatura", info: "Data de assinatura do contrato." },
  { key: "sdr", label: "SDR", info: "Quem prospectou o negócio. Vazio aparece como \"Sem SDR\"." },
  { key: "document", label: "Documento", info: "Só o tipo do documento da empresa (CNPJ ou CPF), nunca o número." },
  { key: "company_type", label: "Tipo de empresa", info: "Classificação da empresa no Pipedrive." },
  { key: "segment", label: "Atuação", info: "Com o que a empresa trabalha, no Pipedrive." },
  { key: "site", label: "Site", info: "Site da empresa." },
  { key: "instagram", label: "Instagram", info: "Perfil do Instagram da empresa." },
  { key: "linkedin", label: "LinkedIn", info: "Página da empresa no LinkedIn." },
];

// Página Patrocínios: dashboard de leitura do evento escolhido no topo, no modelo da aba Comercial.
export default function Sponsorship() {
  const { isSeller, isAdmin } = useAuth();
  const { event, events, isLoading: eventLoading } = useEvent();
  const config = useSponsorshipConfig(event.id);
  const data = useSponsorshipData(config.data);
  const goalsQuery = useGoals();
  const cuponsDoEvento = useSponsorCoupons(event.sympla_event_id);
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const read = useReadCrmAccount();
  const save = useSaveSponsorshipConfig();

  const anterior = events.find((e) => e.slug === event.previous_event_slug);
  const retrasada = anterior ? events.find((e) => e.slug === anterior.previous_event_slug) : undefined;
  // Vendas oficiais da edição anterior, importadas da planilha.
  const historico = useSponsorshipHistory(anterior?.slug);
  const rotuloAnterior = anterior ? anterior.name.match(/\b(20\d{2})\b/)?.[1] ?? anterior.end_date.slice(0, 4) : "";
  const abertura = event.start_date ?? event.end_date;
  // A edição começa no dia seguinte ao último dia da edição anterior; sem anterior, um ano antes da abertura.
  const inicio = anterior ? addDays(anterior.end_date, 1) : addDays(abertura, -365);
  const hoje = saoPauloDate(new Date().toISOString());
  const realConfig: SponsorshipDraft = config.data ?? EMPTY_DRAFT;
  // Negócios do funil que podem ter histórico de valor (abertos e ganhos; o filtro do evento vem depois).
  const idsHistorico = useMemo(() => (data.data?.deals ?? []).filter((d) => d.status !== "lost").map((d) => d.id), [data.data]);
  const valorHist = useValueHistory(realConfig.crm_account, idsHistorico);

  // Sem configuração ou sem negócios sincronizados, a página mostra dados de exemplo identificados como exemplo.
  const exemplo = !realConfig.crm_account || !realConfig.pipelines.length || !data.data || data.data.deals.length === 0;

  const view = useMemo(() => {
    const window = { previousEnd: anterior?.end_date ?? null, eventEnd: event.end_date };
    const prev = anterior
      ? { inicio: retrasada?.end_date ?? addDays(anterior.end_date, -365), fim: anterior.end_date, abertura: anterior.start_date ?? anterior.end_date }
      : null;
    const list = goalsOfEvent(goalsQuery.data ?? [], event) as any[];
    const goals: SponsorshipGoals = {
      ampliada: goalValue(list, SPONSOR_GOAL_KEYS.ampliada),
      minima: goalValue(list, SPONSOR_GOAL_KEYS.minima),
      orcamento: goalValue(list, SPONSOR_GOAL_KEYS.orcamento),
    };
    const porData = (a: any, b: any) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    const quotaGoals: Record<string, number> = {};
    for (const g of list.filter((g) => g.metric_key === SPONSOR_GOAL_KEYS.cotas && g.quota_key).sort(porData)) quotaGoals[g.quota_key] = Number(g.target_value);
    const receiptGoals: Record<number, number> = {};
    for (const g of list.filter((g) => g.metric_key === SPONSOR_GOAL_KEYS.recebimento && g.receipt_year).sort(porData)) receiptGoals[g.receipt_year] = Number(g.target_value);
    const metaAbordagens = goalValue(list, SPONSOR_GOAL_KEYS.abordagens);

    // Cotas sempre como estão no catálogo do CRM (nome, entrada e saída); a configuração só dá ordem, vagas e valor.
    const cotasDoCrm = () => {
      const d = data.data!;
      const nomesVendidos = d.lines.filter((l) => l.is_enabled).map((l) => d.catalog.find((c) => c.pd_id === l.product_pd_id)?.name ?? l.name);
      const comVenda = new Set(nomesVendidos.map((n) => quotaOfProduct(n, realConfig.quotas)?.key).filter(Boolean) as string[]);
      return quotasFromCatalog(d.catalog, realConfig.product_term, realConfig.product_code, realConfig.quotas, comVenda);
    };
    const src = exemplo
      ? exampleDataset(config.data, inicio, hoje, prev?.inicio)
      : { config: { ...realConfig, quotas: cotasDoCrm() }, ...data.data!, quotaGoals };
    const cfg = src.config;
    const m = computeSponsorship(cfg, src.deals, src.lines, src.catalog, window);
    const dealsById = new Map<string, DealRow>(src.deals.map((d) => [d.id, d]));
    const orgs = new Map<number, OrgRow>(src.orgs.map((o) => [o.pd_id, o as OrgRow]));
    const users = new Map<number, string>(src.users.map((u) => [u.pd_id, u.name ?? ""]));
    const hist = exemplo ? [] : historico.data ?? [];
    const oficial = hist.length > 0;
    const share = eventShare(cfg, src.lines, src.catalog);
    const abertosEvento = src.deals.filter((d) => d.status === "open" && share(d).doEvento);
    const curva = exemplo ? examplePrevious : oficial && prev ? historyCurve(hist, prev.abertura) : prev ? previousCurve(cfg, src.deals, src.lines, src.catalog, prev) : null;
    const renov = oficial ? renewalsFromHistory(hist, m, abertosEvento) : prev ? renewals(cfg, src.deals, src.lines, src.catalog, m, prev) : [];
    // Cotas e adicionais da edição anterior no mesmo número de dias antes do evento.
    const diasAteAbertura = Math.max(Math.round((Date.parse(`${abertura}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000), 0);
    const histAteHoje = prev ? hist.filter((h) => h.data && Math.round((Date.parse(`${prev.abertura}T12:00:00Z`) - Date.parse(`${h.data}T12:00:00Z`)) / 86400000) >= diasAteAbertura) : [];
    const cotasAnterior = oficial ? histAteHoje.filter((h) => !h.adicional).length : null;
    const cupons = cuponsDoEvento.data ?? [];
    // Situação dos campos: sempre da configuração real (no exemplo, mostra o que falta de verdade).
    const wonReal = exemplo ? [] : [...new Set(m.vendas.map((v) => v.dealId))].map((id) => dealsById.get(id)!).filter(Boolean);
    const status = fieldStatuses(realConfig, wonReal, exemplo ? new Map() : orgs);
    const statusOf = (k: string) => status.find((s) => s.key === k);
    const columns: SalesColumn[] = SALES_FIELD_COLUMNS.filter((c) => cfg.field_mapping[c.key] && !HIDDEN_INFO_KEYS.includes(c.key)).map((c) => ({
      ...c,
      value: (v) => {
        const ref = cfg.field_mapping[c.key];
        const deal = dealsById.get(v.dealId);
        const org = v.orgId != null ? orgs.get(v.orgId) : undefined;
        const raw = rawField(ref, deal, org);
        if (c.key === "document") return documentType(raw);
        return fieldText(ref, raw, users) ?? (c.key === "sdr" ? "Sem SDR" : null);
      },
    }));
    const instReal = exemplo ? [] : data.data!.installments;
    return {
      cfg,
      m,
      goals: exemplo ? EXAMPLE_GOALS : goals,
      quotaGoals: src.quotaGoals,
      receiptGoals: exemplo ? { [Number(hoje.slice(0, 4))]: 900_000, [Number(hoje.slice(0, 4)) + 1]: 1_300_000 } : receiptGoals,
      metaAbordagens: exemplo ? 400 : metaAbordagens,
      curva,
      renov,
      status,
      statusOf,
      columns,
      prospect: prospecting(cfg, src.deals, src.stages, window, hoje, responsavel, share, cfg.field_mapping.origin
        ? (d) => channelGroup(fieldText(cfg.field_mapping.origin, rawField(cfg.field_mapping.origin, d, undefined), users))
        : undefined),
      oficial,
      cotasAnterior,
      receb: receipts(cfg, m, dealsById, exemplo ? src.installments : instReal, event.end_date),
      entregas: deliveries(cfg, m, dealsById, cupons),
      adicionais: addonItems(m),
      ownerDeals: sponsorDeals(cfg, m, src.deals, src.lines, src.catalog, window, hoje),
      semParcelas: !exemplo && m.vendas.length > 0 && !instReal.some((p) => m.vendas.some((v) => v.dealId === p.deal_id)),
      account: exemplo ? null : realConfig.crm_account,
    };
  }, [exemplo, config.data, data.data, goalsQuery.data, cuponsDoEvento.data, historico.data, event, anterior, retrasada, inicio, hoje, abertura, responsavel, realConfig]);

  // Evolução do valor em negociação: conta pesada, separada do resto para só refazer quando o histórico de valor
  // ou os negócios mudam (e não ao trocar o responsável, por exemplo).
  const evolucao = useMemo(() => {
    if (exemplo || !data.data) return undefined;
    const { deals, lines, catalog } = data.data;
    const share = eventShare(realConfig, lines, catalog);
    const produtos = new Map(catalog.filter((c) => (c.kind ?? "product") === "product").map((c) => [c.pd_id, c]));
    return valueEvolution(
      valorHist.data ?? [],
      new Map(deals.filter((d) => share(d).doEvento).map((d) => [d.id, d])),
      (pid) => {
        const p = produtos.get(pid ?? -1);
        return !!p && isEventProduct(p, realConfig.product_term, realConfig.product_code);
      },
      hoje,
    );
  }, [exemplo, data.data, valorHist.data, realConfig, hoje]);

  const [cotaSel, setCotaSel] = useState<string | null>(null);
  const quotaRows = useMemo(() => quotaBreakdown(view.m, view.cfg.quotas, view.quotaGoals), [view]);
  const metaCotas = Object.values(view.quotaGoals).reduce((s, v) => s + v, 0) || null;
  const semanal = useMemo(() => weeklySeries(view.m, { inicio, abertura, hoje, meta: view.goals.ampliada, anterior: view.curva }), [view, inicio, abertura, hoje]);
  const diasAntes = Math.max(Math.round((Date.parse(`${abertura}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000), 0);
  const vendidoAnterior = view.curva ? view.curva(diasAntes) : null;
  const pendentes = view.status.filter((s) => s.state !== "ok" && !HIDDEN_INFO_KEYS.includes(s.key));

  // Lê a conta do Pipedrive de novo e guarda os campos: campo criado no CRM ativa a parte da página que depende dele
  // e o aviso some (quando também estiver preenchido nas vendas).
  async function conferirCampos() {
    if (!event.id || !realConfig.crm_account) {
      toast.error("Configure a conta do Pipedrive do evento em Configurações › Eventos");
      return;
    }
    try {
      const r = await read.mutateAsync({ eventId: event.id, productTerm: realConfig.product_term });
      const draft: SponsorshipDraft = {
        ...realConfig,
        field_mapping: mappingFromCrm(r.deal_fields, r.organization_fields),
        crm_read: { read_at: new Date().toISOString(), labels: r.deal_fields.find((f) => f.key === "label")?.options ?? [] },
      };
      const antes = Object.keys(realConfig.field_mapping).length;
      await save.mutateAsync({ eventId: event.id, draft });
      const agora = Object.keys(draft.field_mapping).length;
      toast.success(agora > antes ? `${agora - antes} campo(s) novo(s) encontrado(s) no Pipedrive` : "Campos conferidos: nada novo no Pipedrive");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível ler a conta do Pipedrive");
    }
  }

  if (isSeller) return <Navigate to="/" replace />;

  const loading = eventLoading || config.isLoading || goalsQuery.isLoading || (data.isLoading && data.fetchStatus !== "idle");

  return (
    <CompareProvider rotulo={rotuloAnterior}>
      <div>
        <PageHeader
          title="Patrocínios"
          badge={isEventClosed(event) ? <Chip variant="neutral">Encerrado</Chip> : undefined}
          description="Venda de cotas e receita de patrocínio do evento"
          actions={<CompareToggle />}
        />

        <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-80" />
            </div>
          ) : (
            <div className="animate-panel-in space-y-4">
              {exemplo && (
                <p className="rounded-2xl border border-dashed border-line-strong bg-card px-4 py-3 text-sm text-muted-foreground">
                  <b className="font-semibold text-foreground">Dados de exemplo.</b>{" "}
                  {!realConfig.crm_account || !realConfig.pipelines.length
                    ? "O patrocínio deste evento ainda não foi configurado em Configurações › Eventos."
                    : "A integração com o Pipedrive ainda não trouxe negócios deste evento."}{" "}
                  Empresas, valores e metas abaixo são fictícios e servem só para ver o visual. Os avisos "Para investigar no CRM" são reais.
                </p>
              )}
              <div className="grid grid-cols-12 gap-[14px]">
                <SponsorRevenueCard
                  className="col-span-12"
                  vendido={view.m.vendido}
                  emNegociacao={view.m.emNegociacao}
                  negociosAbertos={view.m.negociosAbertos}
                  abertosSemValor={view.m.abertosSemValor}
                  goals={view.goals}
                  anterior={vendidoAnterior}
                  anteriorTotal={view.curva ? view.curva(-100000) : null}
                  semanas={semanal.semanas}
                  lastSync={exemplo ? null : data.data?.lastSync ?? null}
                  exemplo={exemplo}
                />
                <SponsorQuotasCard
                  className="col-span-12 lg:col-span-5"
                  rows={quotaRows}
                  cotasAnterior={view.cotasAnterior}
                  selectedKey={cotaSel}
                  onSelect={(k) => setCotaSel((s) => (s === k ? null : k))}
                />
                <SponsorOwnersCard
                  className="col-span-12 lg:col-span-7"
                  deals={view.ownerDeals}
                  rows={quotaRows}
                  selectedKey={cotaSel}
                  onSelectQuota={setCotaSel}
                />
                <SponsorPaceCard
                  className="col-span-12"
                  semanas={semanal.semanas}
                  meta={view.goals.ampliada}
                  metaCotas={metaCotas}
                  ritmoSemanal={semanal.ritmoSemanal}
                  semanasRestantes={semanal.semanasRestantes}
                />
                <SponsorProspectCard
                  className="col-span-12 lg:col-span-7"
                  data={view.prospect}
                  responsavel={responsavel}
                  onResponsavel={setResponsavel}
                  metaAbordagens={view.metaAbordagens}
                  origem={view.statusOf("origin")}
                  abertosSemValor={view.m.abertosSemValor}
                  evolucao={evolucao}
                />
                <div className="col-span-12 flex flex-col gap-[14px] lg:col-span-5">
                  <SponsorRenewalCard
                    rows={view.renov}
                    rotuloAnterior={rotuloAnterior}
                    cotaAnteriorFalta={view.renov.length > 0 && view.renov.every((r) => !r.cotaAnterior)}
                    oficial={view.oficial}
                  />
                  <SponsorAddonsCard className="flex-1" {...view.adicionais} />
                </div>
                <SponsorReceiptsCard
                  className="col-span-12"
                  data={view.receb}
                  vendido={view.m.vendido}
                  metaPorAno={view.receiptGoals}
                  campos={[]}
                  semParcelasNoCrm={false}
                />
                {FEATURES.entregas && (
                <SponsorDeliveriesCard
                  className="col-span-12"
                  rows={view.entregas}
                  deliverables={view.cfg.deliverables}
                  abertura={abertura}
                  hoje={hoje}
                  campos={[view.statusOf("deliveries"), view.statusOf("brand")]}
                />
                )}
              </div>
              {!exemplo && data.data?.lastSync && (
                <p className="text-right text-[11px] text-muted-foreground">
                  Atualizado em {new Date(data.data.lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </CompareProvider>
  );
}
