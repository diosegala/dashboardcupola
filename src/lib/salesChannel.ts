import { utmLabel } from "@/components/dashboard/CommercialSegments";
import type { Ticket } from "@/hooks/useCommercialMetrics";

// Canal de divulgação a partir dos UTMs. Link da equipe (medium "timecupola") vira Equipe CUPOLA;
// RD Station e e-mail viram E-mail marketing. O resto fica como veio (Instagram, Whatsapp...).
export function canalDe(t: Ticket): string {
  // Faturado interno é venda da equipe (regra do painel de vendas do Summit).
  if (t.source === "pipedrive") return "Equipe CUPOLA";
  const u = utmLabel(t.utm_source);
  if (!u) return t.coupon_code ? "Equipe CUPOLA" : "Sem link";
  const medium = (t.utm_medium ?? "").trim().toLowerCase();
  if (medium === "timecupola") return "Equipe CUPOLA";
  if (/^(rd[-\s]?station|rd|e-?mail.*)$/i.test(u) || medium === "email") return "E-mail marketing";
  return u;
}

// Ingressos e valor por canal, do maior para o menor.
export function vendasPorCanal(pagantes: Ticket[]) {
  const map = new Map<string, { value: number; amount: number }>();
  pagantes.forEach((t) => {
    const k = canalDe(t);
    const c = map.get(k) ?? { value: 0, amount: 0 };
    map.set(k, { value: c.value + (t.quantity || 0), amount: c.amount + Number(t.total_price || 0) });
  });
  return Array.from(map.entries()).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value);
}
