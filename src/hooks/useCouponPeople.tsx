import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { setCouponPeople, type CouponPerson } from "@/lib/coupons";

export interface CouponPersonRow extends CouponPerson {
  id: string;
  userId?: string | null;
  email?: string | null;
  linkManual?: boolean;
}

const CACHE = "cupola-pessoas-cupons";
export const COUPON_PEOPLE_KEY = ["coupon-people"];

function doCache(): CouponPersonRow[] | undefined {
  try {
    const v = localStorage.getItem(CACHE);
    return v ? JSON.parse(v) : undefined;
  } catch {
    return undefined;
  }
}

// Pessoas com mais de um cupom e quem fica fora do ranking, cadastradas em Configurações.
export function useCouponPeople() {
  const { user } = useAuth();
  return useQuery({
    queryKey: COUPON_PEOPLE_KEY,
    enabled: !!user,
    initialData: doCache,
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<CouponPersonRow[]> => {
      const { data, error } = await supabase
        .from("coupon_people")
        .select("id, name, codes, seller_names, outside_ranking, user_id, email, link_manual")
        .order("name");
      if (error) throw error;
      const lista = (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        codes: r.codes ?? [],
        sellerNames: r.seller_names ?? [],
        outsideRanking: r.outside_ranking,
        userId: (r as any).user_id ?? null,
        email: (r as any).email ?? null,
        linkManual: !!(r as any).link_manual,
      }));
      try {
        localStorage.setItem(CACHE, JSON.stringify(lista));
      } catch {
        /* sem espaço: segue sem guardar */
      }
      return lista;
    },
  });
}

// Aplica o cadastro às regras de cupom. Quando o cadastro muda, a tela aberta é refeita para recalcular rankings e listas.
export function CouponPeopleProvider({ children }: { children: ReactNode }) {
  const { data } = useCouponPeople();
  const versao = useMemo(() => {
    const lista = data ?? [];
    setCouponPeople(lista);
    return JSON.stringify(lista);
  }, [data]);
  return <div key={versao} className="contents">{children}</div>;
}
