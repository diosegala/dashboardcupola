// Regras da sincronização da Sympla, sem acesso a rede ou banco, para poderem ser testadas.

export type Row = Record<string, any>;

// Prefixo das linhas de estimativa que versões antigas gravavam; a sincronização agora só apaga essas linhas.
export const PENDING_PREFIX = "pendente-";

const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

export function isApprovedOrder(order: Row | null | undefined): boolean {
  const s = String(order?.order_status ?? "").toUpperCase();
  return s === "A" || s === "APPROVED";
}

// Estado do comprador pela nota fiscal do pedido, quando ainda não há formulário de participante.
export function invoiceState(order: Row): string | null {
  const uf = String(order?.invoice_info?.address_state ?? "").trim();
  return uf || null;
}

// Empresa compradora, só quando a nota sai em CNPJ.
export function invoiceCompany(order: Row): string | null {
  const inv = order?.invoice_info ?? {};
  return String(inv.doc_type ?? "").toUpperCase() === "CNPJ" && inv.client_name ? String(inv.client_name).trim() : null;
}
