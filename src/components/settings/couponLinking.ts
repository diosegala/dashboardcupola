import { supabase } from "@/integrations/supabase/client";
import { formatPersonName } from "@/lib/personName";

// Ligação feita pelo admin: sempre manual, vale mais que a automática. Uma pessoa pode ter várias fichas.
export async function setCouponPeopleForUser(userId: string, personIds: string[]) {
  const solta = await (supabase as any).from("coupon_people").update({ user_id: null, link_manual: true }).eq("user_id", userId);
  if (solta.error) throw solta.error;
  if (!personIds.length) return;
  const liga = await (supabase as any).from("coupon_people").update({ user_id: userId, link_manual: true }).in("id", personIds);
  if (liga.error) throw liga.error;
}

export interface CouponChoice {
  personIds: string[]; // fichas escolhidas (vazio = automático para quem não tem ficha; sem cupom para quem tinha)
  typed: string[]; // códigos novos digitados
}

// Salva a escolha: fichas existentes e, se houver, códigos novos (entram na primeira ficha escolhida ou numa ficha nova).
export async function applyCouponChoice(userId: string, name: string, choice: CouponChoice, currentIds: string[] = []) {
  const mudou = choice.personIds.length !== currentIds.length || choice.personIds.some((id) => !currentIds.includes(id));
  if (mudou) await setCouponPeopleForUser(userId, choice.personIds);
  if (!choice.typed.length) return;
  const alvo = choice.personIds[0];
  if (alvo) {
    const { data } = await supabase.from("coupon_people").select("codes").eq("id", alvo).maybeSingle();
    const codes = Array.from(new Set([...(data?.codes ?? []), ...choice.typed]));
    const r = await supabase.from("coupon_people").update({ codes }).eq("id", alvo);
    if (r.error) throw r.error;
    return;
  }
  const r = await (supabase as any).from("coupon_people").insert({
    name: formatPersonName(name) || "Sem nome", codes: choice.typed, seller_names: [], outside_ranking: false, user_id: userId, link_manual: true,
  });
  if (r.error) throw r.error;
}
