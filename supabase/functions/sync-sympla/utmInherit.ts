// Pedido pago sem UTM herda a UTM da tentativa mais recente do mesmo comprador (mesmo e-mail), em qualquer status,
// feita até 72 horas antes. Quem abre o link, desiste e volta depois costuma comprar sem o link.
export const JANELA_HERANCA_MS = 72 * 60 * 60 * 1000;

export type Utm = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null };

const limpo = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());

export function utmDoPedido(o: any): Utm {
  const u = o?.utm ?? o?.utm_data ?? {};
  return {
    utm_source: limpo(u.utm_source),
    utm_medium: limpo(u.utm_medium),
    utm_campaign: limpo(u.utm_campaign),
    utm_content: limpo(u.utm_content),
  };
}

export const temUtm = (u: Utm) => !!(u.utm_source || u.utm_medium);
const emailDe = (o: any) => limpo(o?.buyer_email ?? o?.email)?.toLowerCase() ?? null;
const quando = (o: any) => {
  const t = Date.parse(String(o?.order_date ?? o?.created_at ?? "").replace(" ", "T"));
  return Number.isFinite(t) ? t : null;
};

// Devolve a UTM herdada para o pedido pago, ou null quando ele já tem UTM ou não há tentativa elegível.
export function utmHerdada(pago: any, todos: any[]): Utm | null {
  if (temUtm(utmDoPedido(pago))) return null;
  const email = emailDe(pago);
  const t = quando(pago);
  if (!email || t == null) return null;
  let melhor: { t: number; utm: Utm } | null = null;
  for (const o of todos) {
    if (String(o?.id) === String(pago?.id) || emailDe(o) !== email) continue;
    const to = quando(o);
    if (to == null || to > t || t - to > JANELA_HERANCA_MS) continue;
    const utm = utmDoPedido(o);
    if (!temUtm(utm)) continue;
    if (!melhor || to > melhor.t) melhor = { t: to, utm };
  }
  return melhor?.utm ?? null;
}
