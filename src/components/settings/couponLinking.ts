import { supabase } from "@/integrations/supabase/client";
import { formatPersonName } from "@/lib/personName";

// Ligação feita pelo admin: sempre manual, vale mais que a automática.
export async function setCouponPersonForUser(userId: string, personId: string | null) {
  const solta = await (supabase as any).from("coupon_people").update({ user_id: null, link_manual: true }).eq("user_id", userId);
  if (solta.error) throw solta.error;
  if (!personId) return;
  const liga = await (supabase as any).from("coupon_people").update({ user_id: userId, link_manual: true }).eq("id", personId);
  if (liga.error) throw liga.error;
}

export interface CouponChoice {
  personId: string | null; // ficha escolhida
  typed: string[]; // códigos novos digitados
}

// Salva a escolha: ficha existente, códigos novos (cria/atualiza a ficha da pessoa) ou automático (não mexe).
export async function applyCouponChoice(userId: string, name: string, choice: CouponChoice, currentPersonId?: string | null) {
  if (choice.typed.length) {
    if (currentPersonId) {
      const { data } = await supabase.from("coupon_people").select("codes").eq("id", currentPersonId).maybeSingle();
      const codes = Array.from(new Set([...(data?.codes ?? []), ...choice.typed]));
      const r = await supabase.from("coupon_people").update({ codes }).eq("id", currentPersonId);
      if (r.error) throw r.error;
      return;
    }
    await setCouponPersonForUser(userId, null);
    const r = await (supabase as any).from("coupon_people").insert({
      name: formatPersonName(name) || "Sem nome", codes: choice.typed, seller_names: [], outside_ranking: false, user_id: userId, link_manual: true,
    });
    if (r.error) throw r.error;
    return;
  }
  if (choice.personId !== (currentPersonId ?? null)) await setCouponPersonForUser(userId, choice.personId);
}
