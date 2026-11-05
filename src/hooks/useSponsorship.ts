import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { draftFromRow, rowFromDraft, type CrmOptions, type SponsorshipDraft } from "@/lib/sponsorship";
import type { CatalogRow, DealProductRow, DealRow } from "@/lib/sponsorshipMetrics";

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
      const { error } = await supabase.from("sponsorship_config").upsert(rowFromDraft(eventId, draft, user?.id ?? null) as any, { onConflict: "event_id" });
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

// Negócios ganhos e abertos dos funis do evento, os produtos desses negócios e o catálogo da conta.
export function useSponsorshipData(config: SponsorshipDraft | undefined) {
  const account = config?.crm_account ?? "";
  const pipes = (config?.pipelines ?? []).map((p) => p.pipeline_pd_id);
  return useQuery({
    queryKey: ["sponsorship", "data", account, pipes.join(",")],
    enabled: !!account && pipes.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const deals = await allPages<DealRow>((from, to) =>
        supabase
          .from("deals")
          .select("id, pipedrive_deal_id, title, org_name, status, value, won_at, pipeline_pd_id, is_deleted")
          .eq("crm_account", account)
          .in("pipeline_pd_id", pipes)
          .in("status", ["won", "open"])
          .eq("is_deleted", false)
          .order("id")
          .range(from, to),
      );
      const lines: DealProductRow[] = [];
      const ids = deals.map((d) => d.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        lines.push(
          ...(await allPages<DealProductRow>((from, to) =>
            supabase.from("deal_products").select("deal_id, product_pd_id, name, quantity, sum, is_enabled").in("deal_id", chunk).order("id").range(from, to),
          )),
        );
      }
      const catalog = await allPages<CatalogRow>((from, to) =>
        supabase.from("crm_products").select("pd_id, name, code").eq("crm_account", account).eq("kind", "product").order("pd_id").range(from, to),
      );
      const { data: sync } = await supabase.from("crm_sync_state").select("last_success_at").eq("crm_account", account).maybeSingle();
      return { deals, lines, catalog, lastSync: (sync as { last_success_at?: string | null } | null)?.last_success_at ?? null };
    },
  });
}
