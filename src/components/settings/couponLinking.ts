import { supabase } from "@/integrations/supabase/client";

// Ligação feita pelo admin: sempre manual, vale mais que a automática.
export async function setCouponPersonForUser(userId: string, personId: string | null) {
  const solta = await supabase.from("coupon_people").update({ user_id: null, link_manual: true } as any).eq("user_id" as any, userId);
  if (solta.error) throw solta.error;
  if (!personId) return;
  const liga = await supabase.from("coupon_people").update({ user_id: userId, link_manual: true } as any).eq("id", personId);
  if (liga.error) throw liga.error;
}
