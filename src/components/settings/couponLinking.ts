import { supabase } from "@/integrations/supabase/client";

// Ligação feita pelo admin: sempre manual, vale mais que a automática.
export async function setCouponPersonForUser(userId: string, personId: string | null) {
  const solta = await (supabase as any).from("coupon_people").update({ user_id: null, link_manual: true }).eq("user_id", userId);
  if (solta.error) throw solta.error;
  if (!personId) return;
  const liga = await (supabase as any).from("coupon_people").update({ user_id: userId, link_manual: true }).eq("id", personId);
  if (liga.error) throw liga.error;
}
