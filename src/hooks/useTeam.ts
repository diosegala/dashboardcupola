import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uniqueCodes } from "@/lib/couponLink";

// Cupons da pessoa logada: vêm da ficha dela no cadastro de cupons. O vínculo é feito sozinho ao entrar.
export function useMyTeamCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team_coupons", "meus", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      await supabase.rpc("link_my_coupon_person" as any);
      const { data, error } = await (supabase as any).from("coupon_people").select("codes").eq("user_id", user!.id).maybeSingle();
      if (error || !data) return [];
      return uniqueCodes((data as any).codes ?? []);
    },
  });
}
