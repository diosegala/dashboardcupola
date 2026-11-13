// Regra do vínculo automático conta → pessoa do cadastro de cupons (igual à função link_coupon_person do banco).
export interface LinkCandidate {
  id: string;
  name: string;
  sellerNames?: string[];
  email?: string | null;
  userId?: string | null;
  linkManual?: boolean;
}

export function matchKey(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Liga só quando há um único resultado: e-mail, depois nome completo, depois primeiro nome (ou primeiro nome + inicial).
export function matchCouponPerson(account: { name?: string | null; email?: string | null }, people: LinkCandidate[]): string | null {
  const livres = people.filter((p) => !p.userId && !p.linkManual);
  const email = matchKey(account.email);
  const nome = matchKey(account.name);
  const primeiro = nome.split(" ")[0] ?? "";
  const curto = nome.includes(" ") ? `${primeiro} ${nome.split(" ").pop()!.charAt(0)}` : primeiro;
  const etapas: Array<(p: LinkCandidate) => boolean> = [
    (p) => !!email && matchKey(p.email) === email,
    (p) => !!nome && (matchKey(p.name) === nome || (p.sellerNames ?? []).some((s) => matchKey(s) === nome)),
    (p) => !!primeiro && [primeiro, curto].includes(matchKey(p.name)),
  ];
  for (const etapa of etapas) {
    const achados = livres.filter(etapa);
    if (achados.length === 1) return achados[0].id;
    if (achados.length > 1) return null;
  }
  return null;
}

// Todos os cupons da pessoa, sem repetir o mesmo código (vale em todos os eventos).
export function uniqueCodes(codes: string[]): string[] {
  return Array.from(new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)));
}
