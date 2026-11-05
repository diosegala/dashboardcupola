import { PRE_VENDA, batchOf, batchOrder } from "@/lib/batches";
import { parseCoupon } from "@/lib/coupons";

// Ingressos faturados internamente: negócios do Pipedrive com ingresso do Summit.
// Ganho no CRM = contrato assinado ou primeira parcela paga: conta como venda. Abertos aparecem à parte, "em negociação".
// Cada negócio vira uma ou mais vendas no formato da Sympla, para somar em valor, quantidade, lotes e ranking.

const sem = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Chave para comparar nomes escritos de jeitos diferentes: só letras, sem letra repetida (SUELLEN = Suelen).
export const chave = (s: unknown) => sem(s).replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");

// Produto de ingresso do Summit. Cotas, adicionais e outros produtos (Mob Report etc.) ficam de fora.
export const isTicketProduct = (name: unknown) => sem(name).startsWith("ingressos summit");

// Nome que a Sympla usaria para o tipo, para o painel reconhecer Padrão, VIP, combos e visita.
export function ticketTypeName(text: unknown): string {
  const n = sem(text);
  if (n.includes("combo") && n.includes("vip")) return "Combo VIP";
  if (n.includes("combo")) return "Combo Padrão";
  if (n.includes("vip")) return "Ingresso VIP";
  if (n.includes("visita")) return "Visita presencial";
  return "Ingresso Padrão";
}

// Título no padrão do comercial: "[SUM] Copa Azul Imóveis | 03 ingressos VIP".
// Empresa entre "]" e "|"; quantidade e tipo depois do "|". Fora do padrão, devolve o que der para ler.
export function parseDealTitle(title: unknown) {
  const t = String(title ?? "");
  const [antes, ...resto] = t.split("|");
  const depois = resto.join("|");
  const empresa = antes.replace(/\[[^\]]*\]/g, "").trim() || null;
  const qtd = depois.match(/(\d+)\s*(?:ingresso|ingr|un|x\b)/i) ?? t.match(/(\d+)\s*ingresso/i);
  return {
    empresa,
    quantidade: qtd ? Number(qtd[1]) : null,
    tipo: /ingress|vip|combo|visita/i.test(depois || t) ? ticketTypeName(depois || t) : null,
    ehSummit: /\[\s*sum/i.test(t) || /summit/i.test(t),
    temIngresso: /ingress/i.test(t),
  };
}

// Palavras do campo "ID do canal de origem" que não são o nome da pessoa ("Indicação Rodrigo", "Venda interna - Suelen").
const NAO_NOME = new Set(["indicacao", "venda", "vendas", "interna", "interno", "de", "da", "do", "dos", "das", "por"]);

// Nome completo e primeiro nome do vendedor: "ISABELLE SALDANHA" → { primeiro: "Isabelle", partes: [...] }.
export function sellerParts(raw: unknown): string[] {
  return String(raw ?? "").trim().split(/[\s\-|/]+/).filter((p) => p && !NAO_NOME.has(sem(p)) && !/^\d+$/.test(p));
}
export function sellerFirstName(raw: unknown): string | null {
  const p = sellerParts(raw)[0]?.toLowerCase();
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : null;
}

// Qual cupom da equipe é desta pessoa: nome, nome + inicial do sobrenome (ALINEB5) ou nome + sobrenome (ALINEPAVEZI5).
// Tolera grafias diferentes (SUELLEN5 para "Suelen Moreira"). Vários candidatos: fica com o mais específico.
export function couponForSeller(raw: unknown, teamCoupons: string[]): string | null {
  const partes = sellerParts(raw).map(chave);
  if (!partes.length) return null;
  const [primeiro, ...sobrenomes] = partes;
  const base = (c: string) => chave(c.replace(/\d+$/, ""));
  // Do mais específico para o mais genérico: nome + sobrenome, nome + inicial, só o nome.
  const exatos = [...sobrenomes.map((s) => primeiro + s), ...sobrenomes.map((s) => primeiro + s[0]), primeiro];
  const porExato = exatos.map((k) => teamCoupons.find((c) => base(c) === k)).find(Boolean);
  if (porExato) return porExato;
  const prefixo = teamCoupons.filter((c) => base(c).startsWith(primeiro));
  return prefixo.length === 1 ? prefixo[0] : null;
}

// Lote vigente numa data: o da última venda da Sympla até aquele dia (o lote muda pela Sympla).
export function batchAt(date: string, symplaSales: { sold_at: string | null; ticket_type?: string | null }[]): string {
  let melhor: { at: string; lote: string } | null = null;
  for (const t of symplaSales) {
    const lote = batchOf(t.ticket_type);
    if (!lote || !t.sold_at || t.sold_at > date) continue;
    if (!melhor || t.sold_at > melhor.at || (t.sold_at === melhor.at && batchOrder(lote) > batchOrder(melhor.lote))) melhor = { at: t.sold_at, lote };
  }
  return melhor?.lote ?? PRE_VENDA;
}

// Canal dos faturados internos na origem da venda.
export const INVOICED_CHANNEL = "Venda direta";

export interface InvoicedDeal {
  id: string;
  pipedrive_deal_id: string;
  title: string | null;
  status: string | null;
  stage_name?: string | null;
  org_name?: string | null;
  value?: number | string | null;
  won_at: string | null;
  created_at_source?: string | null;
  custom_fields: Record<string, unknown> | null;
}
export interface InvoicedLine {
  deal_id: string;
  name: string | null;
  quantity: number | null;
  item_price: number | null;
  sum: number | null;
  // Desconto da linha no Pipedrive (percentual ou valor), quando o comercial preenche.
  discount?: number | null;
  discount_type?: string | null;
}

// Quantidade e preço trocados na linha do produto (ex.: "1775.65x" a R$ 3): quantidade não inteira ou absurda e
// preço que parece quantidade. Corrige trocando os dois; o total da linha não muda.
const MAX_QTD = 200;
export const linhaTrocada = (l: { quantity: number | null; item_price: number | null }) => {
  const q = Number(l.quantity), p = Number(l.item_price);
  return (!Number.isInteger(q) || q > MAX_QTD) && Number.isInteger(p) && p >= 1 && p <= MAX_QTD;
};
const corrigeLinha = <L extends { quantity: number | null; item_price: number | null }>(l: L): L =>
  linhaTrocada(l) ? { ...l, quantity: Number(l.item_price), item_price: Number(l.quantity) } : l;

// Desconto em R$ da linha, quando o comercial preenche o desconto do produto no Pipedrive (percentual ou valor).
// O total (sum) já vem com o desconto aplicado.
export function discountValue(l: { quantity?: number | null; item_price?: number | null; sum?: number | null; discount?: number | null; discount_type?: string | null }): number {
  const d = Number(l.discount || 0);
  if (!(d > 0)) return 0;
  if (l.discount_type === "amount") return Math.round(d * 100) / 100;
  const cheio = Number(l.item_price || 0) * Number(l.quantity || 0);
  return Math.round(((cheio > 0 ? cheio : Number(l.sum || 0) / (1 - d / 100)) * (d / 100)) * 100) / 100;
}

export function invoicedToTickets(deals: InvoicedDeal[], lines: InvoicedLine[], symplaSales: { sold_at: string | null; ticket_type?: string | null }[]) {
  const porNegocio = new Map<string, InvoicedLine[]>();
  lines.filter((l) => isTicketProduct(l.name)).forEach((l) => porNegocio.set(l.deal_id, [...(porNegocio.get(l.deal_id) ?? []), l]));
  return deals
    .filter((d) => d.status === "won" || d.status === "open")
    .flatMap((d) => {
      const titulo = parseDealTitle(d.title);
      const itens = porNegocio.get(d.id) ?? [];
      // Sem produto de ingresso no negócio: usa o título (quantidade e tipo) e o valor do negócio.
      const doTitulo = !itens.length;
      if (doTitulo && !(titulo.ehSummit && titulo.temIngresso)) return [];
      const linhas: Omit<InvoicedLine, "deal_id">[] = doTitulo
        ? [{ name: titulo.tipo ?? "Ingresso Padrão", quantity: titulo.quantidade ?? 1, item_price: null, sum: Number(d.value ?? 0) }]
        : itens.map(corrigeLinha);
      const trocados = !doTitulo && itens.some(linhaTrocada);
      const qtdProdutos = linhas.reduce((s, l) => s + (Number(l.quantity) || 1), 0);
      // Título e produtos com quantidades diferentes: conta pelos produtos e sinaliza para conferir.
      const conferir = doTitulo
        ? titulo.quantidade === null ? "Quantidade não informada no título nem nos produtos" : "Sem produto de ingresso: lido pelo título"
        : trocados ? "Quantidade e preço trocados no produto: corrigido pelo valor total"
        : titulo.quantidade !== null && titulo.quantidade !== qtdProdutos ? `Título diz ${titulo.quantidade}, produtos somam ${qtdProdutos}` : null;
      const ganho = d.status === "won";
      const quando = (ganho ? d.won_at : d.created_at_source) ?? d.created_at_source ?? "";
      const vendedor = String(d.custom_fields?.__channel_id ?? "").trim() || null;
      return linhas.map((l) => ({
        source: "pipedrive" as const,
        quantity: Number(l.quantity) || 1,
        total_price: Number(l.sum ?? 0),
        unit_price: l.item_price ?? (Number(l.quantity) ? Number(l.sum ?? 0) / Number(l.quantity) : 0),
        discount_value: discountValue(l),
        sold_at: quando,
        // Data de cada parcela paga: não vem do CRM (o ganho já indica contrato assinado ou 1ª parcela paga).
        paid_at: null as string | null,
        status: ganho ? "approved" : "crm_open",
        stage_name: ganho ? null : d.stage_name ?? null,
        coupon_code: null,
        // Na origem da venda (Marketing) o faturado aparece como venda direta: nem sempre é da equipe do ranking
        // (o site pede para grandes quantidades chamarem o comercial).
        utm_source: INVOICED_CHANNEL,
        ticket_type: `${batchAt(quando, symplaSales)} | ${ticketTypeName(doTitulo ? titulo.tipo : l.name)}`,
        seller: vendedor,
        seller_name: sellerFirstName(vendedor),
        company: d.org_name || titulo.empresa,
        deal_id: d.pipedrive_deal_id,
        deal_title: d.title,
        conferir,
      }));
    });
}

// Resgate na Sympla de um ingresso já faturado: cupom de 100% (ou FATURADO) com o nome da empresa do negócio
// (padrão EMPRESA+desconto, às vezes com o tipo antes: INGRESSO_PADRAO_COPAZUL100). Não é venda nova.
// Devolve o id do negócio resgatado, ou null quando o cupom não bate com nenhum faturado.
export function redeemedDeal(couponRaw: string | null | undefined, companies: { deal_id: string; company: string | null }[]): string | null {
  const c = parseCoupon(couponRaw);
  if (!c || (c.kind !== "cortesia" && c.kind !== "faturado")) return null;
  const codigo = chave(c.code.replace(/\d+$/, "").replace(/^(faturado|ingresso|ingressos|padrao|vip|combo|visita|_)+/gi, "").replace(/^(ingresso_)?(padrao|vip|combo|combovip|visita)_/i, ""));
  if (codigo.length < 4) return null;
  const achado = companies.find(({ company }) => {
    const k = chave(company);
    if (k.length < 4) return false;
    return k.startsWith(codigo) || codigo.startsWith(k) || (codigo.length >= 6 && k.startsWith(codigo.slice(0, 6)));
  });
  return achado?.deal_id ?? null;
}
