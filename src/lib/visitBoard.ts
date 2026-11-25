// Quadro de visitas: quantas visitas foram vendidas (avulsa ou dentro do combo), a finalidade escolhida no
// formulário da Sympla e quem comprou visita avulsa. Pura, sem acesso ao banco.
import { knownTicketKind } from "@/lib/ticketKinds";

export interface VisitaTicket {
  sympla_order_id?: string | null;
  ticket_type?: string | null;
  quantity?: number | null;
  sold_at?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_company?: string | null;
  company?: string | null;
  source?: "sympla" | "pipedrive";
}

export interface CampoFormulario { name?: string | null; value?: string | null }

export type OrigemVisita = "avulsa" | "combo";

export const NAO_INFORMADO = "Não informado";
// Pergunta da finalidade: fala de visita (ex.: "Em qual visita presencial... você prefere participar?").
const PERGUNTA = /visita/i;

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const LIGACAO = new Set(["visita", "visitas", "presencial", "de", "da", "do", "das", "dos", "para", "pra", "a", "o", "em", "e", "na", "no"]);

// "Visita de locação", "locação" e "Locação " viram "locacao".
export function chaveFinalidade(v: string): string {
  const palavras = semAcento(v).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const uteis = palavras.filter((p) => !LIGACAO.has(p));
  return (uteis.length ? uteis : palavras).join(" ");
}

export function origemDaVisita(ticketType: string | null | undefined): OrigemVisita | null {
  const k = knownTicketKind(ticketType);
  if (k === "Visita presencial") return "avulsa";
  if (k === "Padrão Combo" || k === "VIP Combo") return "combo";
  return null;
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

// Parecidas mas não iguais: uma contém a outra ou quase a mesma escrita. Não agrupa; avisa.
export function parecidas(a: string, b: string): boolean {
  if (a === b || !a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return distancia(a, b) / Math.max(a.length, b.length) <= 0.25;
}

export interface GrupoFinalidade {
  chave: string;
  rotulo: string;
  total: number;
  avulsa: number;
  combo: number;
  // Escritas originais que entraram neste grupo (para auditar o agrupamento).
  escritas: string[];
  // Só em "Não informado": por que cada visita ficou sem resposta.
  motivos?: Record<string, number>;
}

export interface CompradorAvulso {
  nome: string;
  empresa: string | null;
  email: string | null;
  data: string | null;
  quantidade: number;
  finalidades: { rotulo: string; total: number }[];
}

export interface QuadroVisitas {
  total: number;
  avulsas: number;
  combos: number;
  finalidades: GrupoFinalidade[];
  respondidas: number;
  // Nenhuma pergunta de visita reconhecida nos formulários que chegaram: perguntas existentes para corrigir.
  perguntaNaoEncontrada: string[] | null;
  parecidas: [string, string][];
  compradores: CompradorAvulso[];
}

const MOTIVO_FATURADO = "Faturado no Pipedrive, sem formulário da Sympla";
const MOTIVO_SEM_DADOS = "Pedido ainda sem os dados do formulário da Sympla";
const MOTIVO_SEM_RESPOSTA = "Comprador não respondeu a pergunta";

// formularios: respostas do formulário por sympla_order_id (undefined = os dados do pedido ainda não chegaram).
export function montarQuadroVisitas(tickets: VisitaTicket[], formularios: Map<string, CampoFormulario[]>): QuadroVisitas {
  const visitas = tickets.map((t) => ({ t, origem: origemDaVisita(t.ticket_type) })).filter((x) => x.origem) as { t: VisitaTicket; origem: OrigemVisita }[];

  const perguntas = new Set<string>();
  let algumFormulario = false;
  let algumaPergunta = false;
  visitas.forEach(({ t }) => {
    const f = t.sympla_order_id ? formularios.get(t.sympla_order_id) : undefined;
    if (!f) return;
    algumFormulario = true;
    f.forEach((c) => {
      const n = String(c.name ?? "").trim();
      if (n) perguntas.add(n);
      if (PERGUNTA.test(n)) algumaPergunta = true;
    });
  });

  const grupos = new Map<string, GrupoFinalidade & { recente: string }>();
  const respostaDe = new Map<VisitaTicket, string>();
  const nao: GrupoFinalidade = { chave: "", rotulo: NAO_INFORMADO, total: 0, avulsa: 0, combo: 0, escritas: [], motivos: {} };
  let total = 0, avulsas = 0, combos = 0, respondidas = 0;

  // Mais recentes por último, para o rótulo ficar com a escrita atual da Sympla.
  [...visitas].sort((a, b) => String(a.t.sold_at ?? "").localeCompare(String(b.t.sold_at ?? ""))).forEach(({ t, origem }) => {
    const q = t.quantity || 0;
    if (q <= 0) return;
    total += q;
    if (origem === "avulsa") avulsas += q; else combos += q;
    const f = t.source === "pipedrive" || !t.sympla_order_id ? undefined : formularios.get(t.sympla_order_id);
    const valor = String(f?.find((c) => PERGUNTA.test(String(c.name ?? "")))?.value ?? "").trim();
    if (!valor || !algumaPergunta) {
      if (!algumaPergunta && f) return; // pergunta não reconhecida: o card avisa em vez de mostrar tudo como não informado
      const motivo = t.source === "pipedrive" ? MOTIVO_FATURADO : !f ? MOTIVO_SEM_DADOS : MOTIVO_SEM_RESPOSTA;
      nao.total += q;
      nao[origem] += q;
      nao.motivos![motivo] = (nao.motivos![motivo] ?? 0) + q;
      respostaDe.set(t, NAO_INFORMADO);
      return;
    }
    respondidas += q;
    const chave = chaveFinalidade(valor) || valor.toLowerCase();
    const g = grupos.get(chave) ?? { chave, rotulo: valor, recente: valor, total: 0, avulsa: 0, combo: 0, escritas: [] };
    g.total += q;
    g[origem] += q;
    g.rotulo = valor;
    if (!g.escritas.includes(valor)) g.escritas.push(valor);
    grupos.set(chave, g);
    respostaDe.set(t, chave);
  });

  const finalidades: GrupoFinalidade[] = Array.from(grupos.values())
    .map(({ recente: _r, ...g }) => g)
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
  if (nao.total > 0) finalidades.push(nao);

  const chaves = finalidades.filter((g) => g.chave).map((g) => g.chave);
  const pares: [string, string][] = [];
  chaves.forEach((a, i) => chaves.slice(i + 1).forEach((b) => {
    if (parecidas(a, b)) pares.push([grupos.get(a)!.rotulo, grupos.get(b)!.rotulo]);
  }));

  // Compradores de visita avulsa, agrupados pela mesma pessoa (e-mail ou nome).
  const porPessoa = new Map<string, CompradorAvulso & { _f: Map<string, number> }>();
  visitas.filter((v) => v.origem === "avulsa").forEach(({ t }) => {
    const q = t.quantity || 0;
    if (q <= 0) return;
    const nome = String(t.buyer_name ?? "").replace(/\s+/g, " ").trim() || "Sem nome";
    const chave = String(t.buyer_email ?? "").trim().toLowerCase() || semAcento(nome).toLowerCase();
    const p = porPessoa.get(chave) ?? { nome, empresa: null, email: t.buyer_email ?? null, data: null, quantidade: 0, finalidades: [], _f: new Map() };
    p.quantidade += q;
    const daFicha = t.sympla_order_id ? formularios.get(t.sympla_order_id)?.find((c) => /^empresa$|nome da empresa/i.test(String(c.name ?? "").trim()))?.value : null;
    p.empresa = p.empresa ?? (String(t.buyer_company ?? t.company ?? daFicha ?? "").trim() || null);
    if (t.sold_at && (!p.data || t.sold_at < p.data)) p.data = t.sold_at;
    const r = respostaDe.get(t);
    const rotulo = r === NAO_INFORMADO || !r ? NAO_INFORMADO : grupos.get(r)!.rotulo;
    p._f.set(rotulo, (p._f.get(rotulo) ?? 0) + q);
    porPessoa.set(chave, p);
  });
  const compradores = Array.from(porPessoa.values())
    .map(({ _f, ...p }) => ({ ...p, finalidades: Array.from(_f, ([rotulo, total]) => ({ rotulo, total })).sort((a, b) => b.total - a.total) }))
    .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));

  return {
    total, avulsas, combos, finalidades, respondidas,
    perguntaNaoEncontrada: algumFormulario && !algumaPergunta ? Array.from(perguntas).sort() : null,
    parecidas: pares,
    compradores,
  };
}
