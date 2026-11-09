import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseCoupon } from "@/lib/coupons";
import { draftFromRow, rowFromDraft, type CrmOptions, type SponsorshipDraft } from "@/lib/sponsorship";
import type { CatalogRow, DealProductRow, DealRow } from "@/lib/sponsorshipMetrics";
import type { HistorySale, InstallmentRow, OrgRow, StageRow, UserRow, ValueHistoryRow } from "@/lib/sponsorshipExtra";

// Configuração de patrocínio de um evento (linha vazia = ainda não configurado).
export function useSponsorshipConfig(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["sponsorship_config", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sponsorship_config").select("*").eq("event_id", eventId as string).maybeSingle();
      if (error) throw error;
      return draftFromRow(data);
    },
  });
}

// Todas as configurações (usadas ao copiar de outro evento).
export function useAllSponsorshipConfigs(enabled = true) {
  return useQuery({
    queryKey: ["sponsorship_config", "all"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("sponsorship_config").select("*");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.event_id, draftFromRow(r)]));
    },
  });
}

// Depois de confirmar algo, tudo o que depende da configuração é lido de novo.
export function useRefreshSponsorship() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["sponsorship_config"] });
    qc.invalidateQueries({ queryKey: ["sponsorship"] });
  };
}

export function useSaveSponsorshipConfig() {
  const { user } = useAuth();
  const refresh = useRefreshSponsorship();
  return useMutation({
    mutationFn: async ({ eventId, draft }: { eventId: string; draft: SponsorshipDraft }) => {
      const row = rowFromDraft(eventId, draft, user?.id ?? null) as Record<string, unknown>;
      let { error } = await supabase.from("sponsorship_config").upsert(row as any, { onConflict: "event_id" });
      // Banco ainda sem a coluna product_code: salva sem ela (o código também fica no mapeamento de campos).
      if (error && /product_code/.test(`${error.message} ${(error as any).details ?? ""}`)) {
        const { product_code: _semColuna, ...semCodigo } = row;
        ({ error } = await supabase.from("sponsorship_config").upsert(semCodigo as any, { onConflict: "event_id" }));
      }
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

// A função do servidor devolve a mensagem de erro em português no corpo da resposta.
async function mensagemDaFuncao(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch {
    /* sem corpo legível */
  }
  return error?.message ?? "Não foi possível falar com o servidor";
}

// Lê funis, etapas, produtos, campos e usuários da conta do evento (só administradores; o token fica no servidor).
export function useReadCrmAccount() {
  return useMutation({
    mutationFn: async ({ eventId, productTerm }: { eventId: string; productTerm: string }): Promise<CrmOptions> => {
      const { data, error } = await supabase.functions.invoke("list-crm-options", {
        body: { event_id: eventId, ...(productTerm.trim() ? { product_term: productTerm.trim() } : {}) },
      });
      if (error) throw new Error(await mensagemDaFuncao(error));
      if (data?.error) throw new Error(String(data.error));
      return data as CrmOptions;
    },
  });
}

// ---------- dados da página Patrocínios ----------
// Lê em páginas de 1000 linhas (limite do banco por consulta).
async function allPages<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

// Negócios dos funis do evento (abertos, ganhos e perdidos), produtos, catálogo com variações, etapas,
// empresas, usuários e parcelas. Tudo do banco do painel: o Pipedrive só preenche essas tabelas.
export function useSponsorshipData(config: SponsorshipDraft | undefined) {
  const account = config?.crm_account ?? "";
  const pipes = (config?.pipelines ?? []).filter((p) => p.represents !== "ingressos").map((p) => p.pipeline_pd_id);
  return useQuery({
    queryKey: ["sponsorship", "data", account, pipes.join(",")],
    enabled: !!account && pipes.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // O que não depende dos negócios é lido ao mesmo tempo que eles, e não depois.
      const resto = Promise.all([
        allPages<CatalogRow>((from, to) =>
          supabase.from("crm_products").select("pd_id, name, code, kind, parent_pd_id, is_deleted").eq("crm_account", account).order("pd_id").range(from, to),
        ),
        allPages<StageRow>((from, to) =>
          supabase.from("crm_stages").select("pd_id, pipeline_pd_id, name, order_nr, days_to_rotten").eq("crm_account", account).eq("is_deleted", false).in("pipeline_pd_id", pipes).order("pd_id").range(from, to),
        ),
        allPages<UserRow>((from, to) => supabase.from("crm_users").select("pd_id, name").eq("crm_account", account).order("pd_id").range(from, to)),
        supabase.from("crm_sync_state").select("last_success_at").eq("crm_account", account).maybeSingle(),
      ]);
      // Se os negócios falharem, o erro deles é o que importa; o resto não deve gerar aviso solto.
      resto.catch(() => undefined);
      const deals = await allPages<DealRow>((from, to) =>
        supabase
          .from("deals")
          .select(
            "id, pipedrive_deal_id, title, org_name, org_pd_id, owner_name, status, value, won_at, lost_at, lost_reason, created_at_source, stage_id, stage_name, stage_changed_at, label_ids, custom_fields, products_count, pipeline_pd_id, is_deleted",
          )
          .eq("crm_account", account)
          .in("pipeline_pd_id", pipes)
          .in("status", ["won", "open", "lost"])
          .eq("is_deleted", false)
          .order("id")
          .range(from, to),
      );
      // Produtos e parcelas só dos ganhos e abertos (os perdidos entram só na prospecção).
      const ids = deals.filter((d) => d.status !== "lost").map((d) => d.id);
      const orgIds = [...new Set(deals.filter((d) => d.status !== "lost").map((d) => d.org_pd_id).filter((x): x is number => x != null))];
      // Cada grupo de 200 negócios (ou empresas) é lido ao mesmo tempo que os outros; a ordem final é a mesma de antes.
      const emGrupos = async <K, T>(lista: K[], ler: (grupo: K[]) => Promise<T[]>): Promise<T[]> => {
        const grupos: K[][] = [];
        for (let i = 0; i < lista.length; i += 200) grupos.push(lista.slice(i, i + 200));
        return (await Promise.all(grupos.map(ler))).flat();
      };
      const [lines, installments, orgs, [catalog, stages, users, { data: sync }]] = await Promise.all([
        emGrupos(ids, (chunk) =>
          allPages<DealProductRow>((from, to) =>
            supabase.from("deal_products").select("deal_id, product_pd_id, variation_pd_id, name, quantity, sum, is_enabled").in("deal_id", chunk).order("id").range(from, to),
          ),
        ),
        emGrupos(ids, (chunk) => allPages<InstallmentRow>((from, to) => supabase.from("deal_installments").select("deal_id, amount, billing_date").in("deal_id", chunk).order("id").range(from, to))),
        emGrupos(orgIds, (chunk) =>
          allPages<OrgRow>((from, to) => supabase.from("crm_organizations").select("pd_id, name, custom_fields").eq("crm_account", account).in("pd_id", chunk).order("pd_id").range(from, to)),
        ),
        resto,
      ]);
      return { deals, lines, catalog, stages, orgs, users, installments, lastSync: (sync as { last_success_at?: string | null } | null)?.last_success_at ?? null };
    },
  });
}

// ---------- atualização sozinha do Pipedrive ----------
// Enquanto um administrador estiver com o painel aberto, pede a sincronização do Pipedrive quando a última
// tiver mais de 15 minutos. Substitui o agendamento do servidor até ele existir; as duas coisas podem conviver,
// porque a função recusa uma segunda rodada enquanto outra está em andamento.
const QUINZE_MIN = 15 * 60 * 1000;
export function usePipedriveAutoSync(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let rodando = false;
    const verificar = async () => {
      if (rodando || document.hidden) return;
      const { data } = await supabase.from("integrations").select("is_active, sync_status, last_synced_at").eq("name", "pipedrive").maybeSingle();
      if (!data?.is_active) return;
      const idade = data.last_synced_at ? Date.now() - Date.parse(data.last_synced_at) : Infinity;
      if (idade < QUINZE_MIN) return;
      // "Sincronizando" há mais de 30 minutos é uma rodada que foi cortada no meio: pode tentar de novo.
      if (data.sync_status === "syncing" && idade < 2 * QUINZE_MIN) return;
      rodando = true;
      try {
        await supabase.functions.invoke("sync-pipedrive", { body: {} });
        qc.invalidateQueries({ queryKey: ["sponsorship"] });
        qc.invalidateQueries({ queryKey: ["integrations"] });
      } finally {
        rodando = false;
      }
    };
    const id = window.setInterval(verificar, 60 * 1000);
    void verificar();
    return () => window.clearInterval(id);
  }, [enabled, qc]);
}

// Cupons usados nas vendas da Sympla do evento, só para marcar a entrega do cupom. Lê apenas a coluna do cupom,
// e não todos os ingressos como a tela Comercial.
export function useSponsorCoupons(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["sponsorship", "coupons", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const codigos = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("ticket_sales")
          .select("coupon_code")
          .eq("event_id", eventId as string)
          .not("coupon_code", "is", null)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        for (const r of data ?? []) {
          const codigo = parseCoupon(r.coupon_code)?.code;
          if (codigo) codigos.add(codigo);
        }
        if (!data || data.length < 1000) break;
      }
      return [...codigos];
    },
  });
}

// Vendas de patrocínio da edição anterior importadas da planilha (vazio até a importação).
export function useSponsorshipHistory(eventKey: string | null | undefined) {
  return useQuery({
    queryKey: ["sponsorship", "history", eventKey],
    enabled: !!eventKey,
    queryFn: async () => {
      const out: HistorySale[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("event_history")
          .select("data")
          .eq("event_key", eventKey as string)
          .eq("source_table", "sponsorship_sales")
          .range(from, from + 999);
        if (error) return [];
        out.push(...((data ?? []).map((r) => r.data) as unknown as HistorySale[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}

// Histórico do valor dos produtos nos negócios (vazio até o SQL do histórico ser rodado).
export function useValueHistory(account: string | null | undefined, dealIds: string[]) {
  return useQuery({
    queryKey: ["sponsorship", "value_history", account, dealIds.length],
    enabled: !!account && dealIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Cada grupo de 200 negócios é lido ao mesmo tempo que os outros. Qualquer falha deixa a evolução vazia, como antes.
      const grupos: string[][] = [];
      for (let i = 0; i < dealIds.length; i += 200) grupos.push(dealIds.slice(i, i + 200));
      let falhou = false;
      const partes = await Promise.all(
        grupos.map(async (chunk) => {
          const out: ValueHistoryRow[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await (supabase.from("deal_product_value_history" as any) as any)
              .select("deal_id, deal_product_pd_id, product_pd_id, sum, is_enabled, changed_at")
              .in("deal_id", chunk)
              .order("changed_at")
              .range(from, from + 999);
            if (error) {
              falhou = true;
              return out;
            }
            out.push(...((data ?? []) as ValueHistoryRow[]));
            if (!data || data.length < 1000) break;
          }
          return out;
        }),
      );
      return falhou ? [] : partes.flat();
    },
  });
}
