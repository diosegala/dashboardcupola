import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Cupons da pessoa logada (cadastrados em Configurações). Vazio se ainda não tiver.
export function useMyTeamCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team_coupons", "meus", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("team_coupons" as any).select("coupon_code").eq("user_id", user!.id);
      if (error) return [];
      return (data ?? []).map((r: any) => String(r.coupon_code).toUpperCase());
    },
  });
}

// Todos os cupons da equipe por pessoa (só administradores conseguem ler).
export function useTeamCoupons(enabled: boolean) {
  return useQuery({
    queryKey: ["team_coupons", "todos"],
    enabled,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await supabase.from("team_coupons" as any).select("user_id, coupon_code");
      if (error) return {};
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r: any) => (map[r.user_id] ??= []).push(String(r.coupon_code).toUpperCase()));
      return map;
    },
  });
}
