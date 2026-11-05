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

// Título no padrão do comercial: "[SUM] Copa Azul Imóveis | 03 ingressos VIP" ou com vários tipos,
// "[SUM] Empresa | 02 ingressos VIP + 05 padrão". Empresa entre "]" e "|"; depois do "|", cada número seguido de
// "ingresso" ou de um tipo vira um item (quantidade e tipo). Sem tipo escrito, é Padrão.
const ITEM_TITULO = /(\d+)\s*(?:x\s*)?(ingressos?|ingr\.?)?\s*(combo\s*vip|combo\s*padr[aã]o|combo|vip|padr[aã]o|visita(?:\s*presencial)?)?/gi;
export function parseDealTitle(title: unknown) {
  const t = String(title ?? "");
  const [antes, ...resto] = t.split("|");
  const depois = resto.length ? resto.join("|") : t;
  const empresa = resto.length ? antes.replace(/\[[^\]]*\]/g, "").trim() || null : null;
  const itens: { quantidade: number; tipo: string }[] = [];
  for (const m of depois.matchAll(ITEM_TITULO)) {
    if (!m[2] && !m[3]) continue; // número solto (ano, lote): não é quantidade de ingresso
    // Item só com o tipo e sem "ingresso" logo depois de outro item: "02 ingressos VIP + 03 padrão".
    itens.push({ quantidade: Number(m[1]), tipo: ticketTypeName(m[3] ?? "padrão") });
  }
  const quantidade = itens.length ? itens.reduce((s, i) => s + i.quantidade, 0) : null;
  return {
    empresa,
    itens,
    quantidade,
    tipo: itens[0]?.tipo ?? null,
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

// Quantos negócios faturados ganhos têm o desconto do produto preenchido no Pipedrive. Serve para pedir ao comercial
// que preencha: sem o campo, o desconto desses ingressos não entra nos cards de desconto.
export function crmDiscountCoverage(tickets: { source?: string; status?: string | null; deal_id?: string; discount_value?: number }[]) {
  const ganhos = tickets.filter((t) => t.source === "pipedrive" && t.status === "approved");
  const negocios = new Set(ganhos.map((t) => t.deal_id));
  const comDesconto = new Set(ganhos.filter((t) => (t.discount_value || 0) > 0).map((t) => t.deal_id));
  return { negocios: negocios.size, comDesconto: comDesconto.size, faltam: negocios.size - comDesconto.size };
}
export const CRM_DISCOUNT_HINT = "Preencha o desconto do produto no negócio do Pipedrive (percentual ou valor) para o desconto dos faturados entrar aqui.";

// Campos do negócio no Pipedrive da CUPOLA (chave do campo e opções), lidos de custom_fields.
// Forma de pagamento "Bonificação / Permuta" não é venda: o ingresso vira bonificado.
const CAMPO_PAGAMENTO = "95a9b3af39e19647be9bb10201d833c81ec9b4a6";
const PAGAMENTO_BONIFICACAO = 675;
const CAMPO_PARCELAS = "7314c9175151684808ceb779af44fd5ced19902e";
// Opções 680 (01) a 693 (14).
const parcelasDe = (v: unknown) => {
  const id = Number(typeof v === "object" && v ? (v as any).id ?? (v as any).value : v);
  return id >= 680 && id <= 693 ? id - 679 : null;
};
// Opções da Forma de pagamento no mesmo código da Sympla, para somar no mesmo card (Hotmart conta junto).
const PAGAMENTO_CODIGO: Record<number, string> = { 672: "PIX", 673: "CREDIT_CARD", 674: "BOLETO", 694: "CREDIT_CARD", 695: "PIX", 696: "BOLETO" };
const opcao = (v: unknown) => Number(typeof v === "object" && v ? (v as any).id ?? (v as any).value : v);

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

// Itens do título viram linhas: cada tipo com sua quantidade. O valor do negócio é dividido pela quantidade
// (o título não traz preço por tipo); sem itens no título, uma linha de 1 ingresso Padrão para conferir.
function tituloEmLinhas(itens: { quantidade: number; tipo: string }[], valor: number) {
  const lista = itens.length ? itens : [{ quantidade: 1, tipo: "Ingresso Padrão" }];
  const total = lista.reduce((s, i) => s + i.quantidade, 0) || 1;
  return lista.map((i) => ({ name: i.tipo, quantity: i.quantidade, item_price: Math.round((valor / total) * 100) / 100, sum: Math.round(((valor * i.quantidade) / total) * 100) / 100 }));
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
        ? tituloEmLinhas(titulo.itens, Number(d.value ?? 0))
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
      const bonificado = opcao(d.custom_fields?.[CAMPO_PAGAMENTO]) === PAGAMENTO_BONIFICACAO;
      const parcelas = parcelasDe(d.custom_fields?.[CAMPO_PARCELAS]);
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
        // Bonificação / Permuta: não é venda, conta como bonificado. Parcelado: só indica, as datas ficam com o financeiro.
        bonus: bonificado,
        installments: parcelas && parcelas > 1 ? parcelas : null,
        payment_method: PAGAMENTO_CODIGO[opcao(d.custom_fields?.[CAMPO_PAGAMENTO])] ?? null,
        // Parcelas escolhidas (1 = à vista), para a média no cartão de crédito.
        installments_count: parcelas,
        coupon_code: null,
        // Na origem da venda (Marketing) o faturado aparece como venda direta: nem sempre é da equipe do ranking
        // (o site pede para grandes quantidades chamarem o comercial).
        utm_source: INVOICED_CHANNEL,
        ticket_type: `${batchAt(quando, symplaSales)} | ${ticketTypeName(l.name)}`,
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
