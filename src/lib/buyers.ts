// Identificação de pessoas e empresas entre eventos, a partir dos dados completos da Sympla.
// Uma pessoa pode aparecer como compradora (quem pagou o pedido) e como participante (quem resgatou o ingresso),
// com variações de nome, e-mail ou telefone. Juntamos os registros que compartilham qualquer identificador forte.

export type Role = "comprador" | "participante";

export interface DetailRow {
  sympla_order_id: string;
  participant_data: any | null;
  order_data: any | null;
}

export interface EventRef {
  slug: string;
  name: string;
  year: string;
}

interface RawRecord {
  event: EventRef;
  role: Role;
  orderId: string;
  name: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  phone: string | null;
  company: string | null;
  status: string | null;
}

export interface Person {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  cpf: string | null;
  companies: string[];
  // Por evento: em quais papéis a pessoa apareceu e quantos ingressos resgatou.
  events: Record<string, { event: EventRef; roles: Set<Role>; tickets: number; orders: Set<string> }>;
  recurring: boolean;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  people: number;
  events: Record<string, { event: EventRef; tickets: number }>;
  recurring: boolean;
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function normEmail(e: unknown): string | null {
  const v = String(e ?? "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

export function normName(n: unknown): string | null {
  const v = strip(String(n ?? "")).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return v.split(" ").length >= 2 ? v : null;
}

export function normPhone(p: unknown): string | null {
  let d = digits(p);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? d.slice(-11) : null;
}

function normCompany(c: unknown): string | null {
  const v = strip(String(c ?? "")).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(ltda|me|eireli|sa|s a|imoveis|imobiliaria)\b/g, " ").replace(/\s+/g, " ").trim();
  return v.length >= 3 ? v : null;
}

function splitDoc(doc: unknown): { cpf: string | null; cnpj: string | null } {
  const d = digits(doc);
  if (d.length === 11) return { cpf: d, cnpj: null };
  if (d.length === 14) return { cpf: null, cnpj: d };
  return { cpf: null, cnpj: null };
}

function formValue(p: any, test: RegExp): string | null {
  const f = (p?.custom_form ?? []).find((x: any) => test.test(String(x?.name ?? "")));
  const v = f?.value != null ? String(f.value).trim() : "";
  return v || null;
}

function toRecords(row: DetailRow, event: EventRef): RawRecord[] {
  const out: RawRecord[] = [];
  const o = row.order_data;
  const p = row.participant_data;
  const orderId = String(o?.id ?? p?.order_id ?? row.sympla_order_id);

  if (p) {
    const doc = splitDoc(formValue(p, /cpf|cnpj/i));
    out.push({
      event,
      role: "participante",
      orderId,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      email: p.email ?? null,
      cpf: doc.cpf,
      cnpj: doc.cnpj,
      phone: formValue(p, /whats|telefone|celular/i),
      company: formValue(p, /^empresa$|nome da empresa/i),
      status: p.order_status ?? null,
    });
  }
  if (o) {
    const inv = o.invoice_info ?? {};
    const doc = splitDoc(inv.doc_number);
    out.push({
      event,
      role: "comprador",
      orderId,
      name: [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(" ") || inv.client_name || null,
      email: o.buyer_email ?? null,
      cpf: doc.cpf,
      cnpj: doc.cnpj,
      phone: null,
      company: doc.cnpj ? inv.client_name ?? null : null,
      status: o.order_status ?? null,
    });
  }
  return out;
}

class UnionFind {
  parent: number[] = [];
  add() {
    this.parent.push(this.parent.length);
    return this.parent.length - 1;
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

function mostCommon(values: (string | null)[]): string | null {
  const count = new Map<string, number>();
  values.forEach((v) => v && count.set(v, (count.get(v) || 0) + 1));
  return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function buildBuyers(rowsByEvent: { event: EventRef; rows: DetailRow[] }[]) {
  const records: RawRecord[] = [];
  rowsByEvent.forEach(({ event, rows }) => {
    // Comprador entra uma vez por pedido, mesmo com vários ingressos.
    const seenBuyer = new Set<string>();
    rows.forEach((row) =>
      toRecords(row, event).forEach((r) => {
        if (r.role === "comprador") {
          if (seenBuyer.has(r.orderId)) return;
          seenBuyer.add(r.orderId);
        }
        records.push(r);
      }),
    );
  });

  // Pessoas: juntam por e-mail, CPF, telefone ou nome completo.
  const uf = new UnionFind();
  const byKey = new Map<string, number>();
  records.forEach((r) => {
    const i = uf.add();
    const keys = [
      normEmail(r.email) && `e:${normEmail(r.email)}`,
      r.cpf && `c:${r.cpf}`,
      normPhone(r.phone) && `t:${normPhone(r.phone)}`,
      normName(r.name) && `n:${normName(r.name)}`,
    ].filter(Boolean) as string[];
    keys.forEach((k) => {
      const j = byKey.get(k);
      if (j === undefined) byKey.set(k, i);
      else uf.union(i, j);
    });
  });

  const groups = new Map<number, RawRecord[]>();
  records.forEach((r, i) => {
    const root = uf.find(i);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  });

  const people: Person[] = Array.from(groups.entries()).map(([root, recs]) => {
    const events: Person["events"] = {};
    recs.forEach((r) => {
      const e = (events[r.event.slug] ??= { event: r.event, roles: new Set(), tickets: 0, orders: new Set() });
      e.roles.add(r.role);
      e.orders.add(r.orderId);
      if (r.role === "participante") e.tickets += 1;
    });
    return {
      id: String(root),
      name: mostCommon(recs.map((r) => r.name)) ?? "Sem nome",
      emails: Array.from(new Set(recs.map((r) => normEmail(r.email)).filter(Boolean) as string[])),
      phones: Array.from(new Set(recs.map((r) => normPhone(r.phone)).filter(Boolean) as string[])),
      cpf: mostCommon(recs.map((r) => r.cpf)),
      companies: Array.from(new Set(recs.map((r) => r.company).filter(Boolean) as string[])),
      events,
      recurring: Object.keys(events).length >= 2,
    };
  });

  // Empresas: juntam por CNPJ ou nome normalizado.
  const cuf = new UnionFind();
  const cKey = new Map<string, number>();
  const cRecs: RawRecord[] = records.filter((r) => r.cnpj || normCompany(r.company));
  cRecs.forEach((r) => {
    const i = cuf.add();
    [r.cnpj && `j:${r.cnpj}`, normCompany(r.company) && `m:${normCompany(r.company)}`]
      .filter(Boolean)
      .forEach((k) => {
        const j = cKey.get(k as string);
        if (j === undefined) cKey.set(k as string, i);
        else cuf.union(i, j);
      });
  });
  const cGroups = new Map<number, RawRecord[]>();
  cRecs.forEach((r, i) => {
    const root = cuf.find(i);
    cGroups.set(root, [...(cGroups.get(root) ?? []), r]);
  });
  const personOf = new Map<RawRecord, string>();
  records.forEach((r, i) => personOf.set(r, String(uf.find(i))));
  const companies: Company[] = Array.from(cGroups.entries()).map(([root, recs]) => {
    const events: Company["events"] = {};
    recs.forEach((r) => {
      const e = (events[r.event.slug] ??= { event: r.event, tickets: 0 });
      if (r.role === "participante") e.tickets += 1;
    });
    return {
      id: String(root),
      name: mostCommon(recs.map((r) => r.company)) ?? "Sem nome",
      cnpj: mostCommon(recs.map((r) => r.cnpj)),
      people: new Set(recs.map((r) => personOf.get(r))).size,
      events,
      recurring: Object.keys(events).length >= 2,
    };
  });

  return { people, companies };
}

// Pedidos que não estão aprovados (pendentes, recusados, cancelados), um por pedido.
export function pendingOrders(rows: DetailRow[]) {
  const map = new Map<string, { orderId: string; buyer: string; email: string | null; status: string; date: string | null; tickets: number }>();
  rows.forEach((row) => {
    const o = row.order_data;
    const p = row.participant_data;
    const status = String(o?.order_status ?? p?.order_status ?? "").toUpperCase();
    if (!status || status === "APPROVED" || status === "A") return;
    const orderId = String(o?.id ?? p?.order_id ?? row.sympla_order_id);
    const atual = map.get(orderId) ?? {
      orderId,
      buyer: [o?.buyer_first_name, o?.buyer_last_name].filter(Boolean).join(" ") || [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Sem nome",
      email: o?.buyer_email ?? p?.email ?? null,
      status,
      date: o?.order_date ?? p?.order_date ?? null,
      tickets: 0,
    };
    if (p) atual.tickets += 1;
    map.set(orderId, atual);
  });
  return Array.from(map.values()).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export function maskCpf(cpf: string | null) {
  return cpf ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : "—";
}

export function formatPhone(p: string) {
  return p.length === 11 ? `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}` : `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
}
