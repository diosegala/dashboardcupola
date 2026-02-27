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
      toast.error("Erro ao atualizar integração: " + err.message);
    },
  });

  const syncIntegration = useMutation({
    mutationFn: async (name: string) => {
      const fnName = `sync-${name.replace(/_/g, "-")}`;
      const { error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sincronização iniciada!");
      // Poll for status updates
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["integrations"] }), 2000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["integrations"] }), 5000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["integrations"] }), 10000);
    },
    onError: (err) => {
      toast.error("Erro ao sincronizar: " + err.message);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  return { integrations: query.data ?? [], isLoading: query.isLoading, updateIntegration, syncIntegration };
}
