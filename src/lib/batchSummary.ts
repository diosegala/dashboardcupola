import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { batchOf, batchOrder } from "@/lib/batches";
import { fullPrices } from "@/lib/lotPrice";
import { batchCalendar, hojeBrasilia, loteVigente, situacao, type BatchDates, type Situacao } from "@/lib/batchCalendar";

export interface Lote {
  lote: string;
  pagantes: number;
  receita: number;
  meta: number | null;
  preco: number | null;
  metaReceita: number | null;
  anterior: number | null;
  anteriorReceita: number | null;
  // Pelas datas da configuração de lotes (null quando o lote não está cadastrado).
  situacao: Situacao | null;
  esgotado: boolean;
  inicio: string | null;
  fim: string | null;
}

// Soma pagantes e receita por lote (Pré-venda, Lote 0, Lote 1…), juntando os nomes que mudam a cada ano.
export function porLote(tickets: Ticket[]) {
  const map = new Map<string, { pagantes: number; receita: number; ultimaVenda: string }>();
  splitTickets(tickets).paying.forEach((t) => {
    const lote = batchOf(t.ticket_type);
    if (!lote) return;
    const atual = map.get(lote) ?? { pagantes: 0, receita: 0, ultimaVenda: "" };
    atual.pagantes += t.quantity || 0;
    atual.receita += Number(t.total_price || 0);
    if ((t.sold_at ?? "") > atual.ultimaVenda) atual.ultimaVenda = t.sold_at ?? "";
    map.set(lote, atual);
  });
  return map;
}

// Lotes do evento (mesma regra da aba "Por lote"): vigente = lote com a venda pagante mais recente.
export function resumoLotes(goals: any[], allTimeTickets: Ticket[], previousYearTickets: Ticket[], calendario: BatchDates[] = batchCalendar(), hoje = hojeBrasilia()) {
    const atual = porLote(allTimeTickets);
    const anterior = porLote(previousYearTickets);
    // Metas por lote: a meta de ingressos do lote (tela Metas), somando os nomes que caem no mesmo lote.
    const somaMetas = (chave: string) => {
      const m = new Map<string, number>();
      goals
        .filter((g) => g.metric_key === chave && g.ticket_type)
        .forEach((g) => {
          const lote = batchOf(g.ticket_type);
          if (lote) m.set(lote, (m.get(lote) ?? 0) + Number(g.target_value || 0));
        });
      return m;
    };
    const metas = somaMetas("tickets_sold");
    const metasReceita = somaMetas("revenue");
    const nomes = new Set([...atual.keys(), ...metas.keys(), ...metasReceita.keys(), ...calendario.map((c) => c.name)]);
    // Com calendário cadastrado, vale a data de hoje (Brasília); sem ele, o lote da venda mais recente (regra antiga).
    const vig = loteVigente(calendario, hoje);
    const loteAtual = calendario.length
      ? vig.lote
      : Array.from(atual.entries()).sort((a, b) => b[1].ultimaVenda.localeCompare(a[1].ultimaVenda))[0]?.[0] ?? null;
    const doCalendario = (lote: string) => {
      const c = calendario.find((x) => x.name === lote);
      const pagantes = atual.get(lote)?.pagantes ?? 0;
      const meta = metas.get(lote) ?? null;
      return { situacao: c ? situacao(c, hoje) : null, esgotado: !!meta && pagantes >= meta, inicio: c?.start_date ?? null, fim: c?.end_date ?? null };
    };
    const { byBatch: precos } = fullPrices(allTimeTickets);
    const lotes: Lote[] = Array.from(nomes)
      .sort((a, b) => batchOrder(a) - batchOrder(b))
      .map((lote) => ({
        lote,
        pagantes: atual.get(lote)?.pagantes ?? 0,
        receita: atual.get(lote)?.receita ?? 0,
        meta: metas.get(lote) ?? null,
        preco: precos.get(lote) ?? null,
        metaReceita: metasReceita.get(lote) ?? null,
        anterior: anterior.get(lote)?.pagantes ?? null,
        anteriorReceita: anterior.get(lote)?.receita ?? null,
        ...doCalendario(lote),
      }));
    return { lotes, loteAtual, faltamDatas: vig.faltamDatas };
}

// Progresso de um lote em relação à meta: % vendido e saldo (null sem meta).
export function progressoLote(vendidos: number, meta: number | null) {
  if (!meta) return { pct: null as number | null, saldo: null as number | null };
  return { pct: vendidos / meta, saldo: Math.max(meta - vendidos, 0) };
}
