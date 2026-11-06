import { traduzirErro } from "@/lib/mensagensErro";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Integration = Tables<"integrations">;

export function useIntegrations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Integration[];
    },
    // Enquanto alguma integração estiver sincronizando, confere o status a cada 3 segundos.
    refetchInterval: (q) => (q.state.data?.some((i) => i.sync_status === "syncing") ? 3000 : false),
  });

  const updateIntegration = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Integration, "is_active" | "credentials">>;
    }) => {
      const { error } = await supabase
        .from("integrations")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => {
      toast.error("Erro ao atualizar integração: " + traduzirErro(err));
    },
  });

  const syncIntegration = useMutation({
    mutationFn: async (name: string) => {
      const fnName = `sync-${name.replace(/_/g, "-")}`;
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      // A Sympla devolve um resumo por evento; avisa quando algum pedido aprovado ainda não tem todos os ingressos.
      const resumo: any[] = Array.isArray(data?.resumo) ? data.resumo : [];
      const faltam = resumo.reduce((s, r) => s + (Number(r.pedidos_incompletos) || 0), 0);
      if (resumo.length) {
        toast.success("Sympla sincronizada!");
        if (faltam) toast.warning(`${faltam.toLocaleString("pt-BR")} pedidos aprovados ainda sem todos os participantes na API da Sympla.`);
      } else toast.success("Sincronização iniciada!");
      // Busca o status na hora; o refetchInterval acompanha até a sincronização terminar.
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["integrations_health"] });
    },
    onError: (err) => {
      toast.error("Erro ao sincronizar: " + traduzirErro(err));
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["integrations_health"] });
    },
  });

  return { integrations: query.data ?? [], isLoading: query.isLoading, updateIntegration, syncIntegration };
}
