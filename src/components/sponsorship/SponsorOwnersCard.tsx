import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CardTabs } from "./CardTabs";
import { ownerDisplayNames, ownerRanking, ownerStats, type DealStatusPt, type QuotaRow, type SponsorDealRow } from "@/lib/sponsorshipMetrics";
import { brl } from "./SponsorRevenueCard";

const INFO = {
  ranking:
    "Cada negócio do Pipedrive conta para o responsável (proprietário) dele. Vendidas e em negociação são os mesmos números das barras de cotas. Perdidos são negócios perdidos nesta edição. Clique no nome para ver os negócios.",
  lista: "Todos os negócios de patrocínio desta edição, um por linha. Clique no título de uma coluna para ordenar e no responsável para ver o resumo dele.",
};
const STATUS_LABEL: Record<DealStatusPt, string> = { ganho: "Ganho", negociacao: "Em negociação", perdido: "Perdido" };
const STATUS_CLS: Record<DealStatusPt, string> = {
  ganho: "bg-ok-bg text-ok",
  negociacao: "bg-secondary text-muted-foreground",
  perdido: "bg-bad-bg text-bad",
};
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dia = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const valor = (v: number | null) => (v == null ? <span className="text-[11px] font-normal italic text-muted-foreground">valor não informado</span> : brl(v));
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

function StatusPill({ s }: { s: DealStatusPt }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[s]}`}>{STATUS_LABEL[s]}</span>;
}

type SortKey = "empresa" | "cota" | "owner" | "status" | "valor" | "etapa" | "data" | "motivo";

export function SponsorOwnersCard({
  deals,
  rows,
  selectedKey,
  onSelectQuota,
  className,
}: {
  deals: SponsorDealRow[];
  rows: QuotaRow[];
  selectedKey: string | null;
  onSelectQuota: (k: string | null) => void;
  className?: string;
}) {
  const [aba, setAba] = useState<"ranking" | "lista">("ranking");
  const [ordem, setOrdem] = useState<"valor" | "cotas">("valor");
  const [status, setStatus] = useState<DealStatusPt | "todos">("negociacao");
  const [resp, setResp] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "data", asc: false });
  const [painel, setPainel] = useState<string | null>(null);

  const nomes = useMemo(() => ownerDisplayNames(deals.map((d) => d.owner)), [deals]);
  const nome = (o: string) => nomes.get(o) ?? o;
  const cotas = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const r of rows) vistos.set(r.key, r.nome);
    for (const d of deals) if (!vistos.has(d.cotaKey)) vistos.set(d.cotaKey, d.cota);
    return [...vistos.entries()].filter(([k]) => deals.some((d) => d.cotaKey === k));
  }, [rows, deals]);
  const cotaNome = cotas.find(([k]) => k === selectedKey)?.[1];

  const ranking = useMemo(() => ownerRanking(deals, selectedKey, ordem), [deals, selectedKey, ordem]);
  const lider = Math.max(...ranking.map((r) => (ordem === "valor" ? r.valorFechado : r.cotasVendidas)), 1);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const f = deals.filter(
      (d) =>
        (selectedKey == null || d.cotaKey === selectedKey) &&
        (status === "todos" || d.status === status) &&
        (resp === "todos" || d.owner === resp) &&
        (!q || d.empresa.toLowerCase().includes(q)),
    );
    const get = (d: SponsorDealRow): string | number => {
      if (sort.k === "valor") return d.valor ?? -1;
      if (sort.k === "owner") return nome(d.owner);
      if (sort.k === "status") return STATUS_LABEL[d.status];
      return (d[sort.k] as string | null) ?? "";
    };
    return [...f].sort((a, b) => {
      const x = get(a), y = get(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return sort.asc ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, selectedKey, status, resp, busca, sort, nomes]);

  const donos = useMemo(() => [...new Set(deals.map((d) => d.owner))].sort((a, b) => nome(a).localeCompare(nome(b), "pt-BR")), [deals, nomes]); // eslint-disable-line react-hooks/exhaustive-deps

  const Th = ({ k, children, right }: { k: SortKey; children: string; right?: boolean }) => (
    <th className={`whitespace-nowrap px-2 pb-2 font-medium ${right ? "text-right" : ""}`}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>
        {children}
        {sort.k === k && (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <Card className={className}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Vendas por responsável</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Quem fechou, quem está negociando e quem perdeu cada cota, com os dados do Pipedrive.</p>
          </div>
          <CardTabs
            value={aba}
            onChange={setAba}
            tabs={[
              { value: "ranking", label: "Ranking", info: INFO.ranking },
              { value: "lista", label: "Lista", info: INFO.lista },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedKey == null ? "__todas" : selectedKey || "__outros"} onValueChange={(v) => onSelectQuota(v === "__todas" ? null : v === "__outros" ? "" : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas">Todas as cotas</SelectItem>
              {cotas.map(([k, n]) => <SelectItem key={k || "outros"} value={k || "__outros"}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          {aba === "ranking" ? (
            <div className="ml-auto inline-flex rounded-full bg-secondary p-0.5 text-[11px]">
              {(["valor", "cotas"] as const).map((o) => (
                <button key={o} type="button" onClick={() => setOrdem(o)} className={`rounded-full px-2.5 py-1 font-medium transition-colors ${ordem === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {o === "valor" ? "Valor fechado" : "Cotas vendidas"}
                </button>
              ))}
            </div>
          ) : (
            <>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="ganho">Ganho</SelectItem>
                  <SelectItem value="negociacao">Em negociação</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resp} onValueChange={setResp}>
                <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os responsáveis</SelectItem>
                  {donos.map((o) => <SelectItem key={o} value={o}>{nome(o)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative min-w-[160px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa" className="h-8 pl-8 text-xs" />
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {aba === "ranking" ? (
          ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum negócio {cotaNome ? `de ${cotaNome} ` : ""}ainda.</p>
          ) : (
            <ol className="space-y-0.5">
              {ranking.map((r, i) => {
                const base = ordem === "valor" ? r.valorFechado : r.cotasVendidas;
                const top = i === 0 && base > 0;
                return (
                  <li key={r.owner}>
                    <button
                      type="button"
                      onClick={() => setPainel(r.owner)}
                      className={`group grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/60 ${top ? "bg-secondary/40" : ""}`}
                    >
                      <span className={`text-center text-sm tabular-nums ${top ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{i + 1}º</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold group-hover:underline">{nome(r.owner)}</span>
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-secondary">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(base / lider) * 100}%` }} />
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                          {int(r.cotasVendidas)} {r.cotasVendidas === 1 ? "vendida" : "vendidas"} · {int(r.emNegociacao)} em negociação · {int(r.perdidos)} {r.perdidos === 1 ? "perdido" : "perdidos"}
                        </span>
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums">{ordem === "valor" ? brl(r.valorFechado) : `${int(r.cotasVendidas)} cotas`}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground">
                <tr>
                  <Th k="empresa">Empresa</Th>
                  <Th k="cota">Cota</Th>
                  <Th k="owner">Responsável</Th>
                  <Th k="status">Status</Th>
                  <Th k="valor" right>Valor</Th>
                  <Th k="etapa">Etapa</Th>
                  <Th k="data">Data</Th>
                  <Th k="motivo">Motivo da perda</Th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum negócio com esses filtros.</td></tr>
                ) : (
                  lista.map((d) => (
                    <tr key={d.key} className="border-t align-top">
                      <td className="max-w-[180px] truncate px-2 py-2 font-medium">{d.empresa}</td>
                      <td className="whitespace-nowrap px-2 py-2">{d.cota}</td>
                      <td className="px-2 py-2"><button type="button" className="whitespace-nowrap font-medium hover:underline" onClick={() => setPainel(d.owner)}>{nome(d.owner)}</button></td>
                      <td className="px-2 py-2"><StatusPill s={d.status} /></td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{valor(d.valor)}</td>
                      <td className="max-w-[140px] truncate px-2 py-2 text-muted-foreground">{d.status === "negociacao" ? d.etapa ?? "—" : ""}</td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums">{dia(d.data)}</td>
                      <td className="max-w-[180px] px-2 py-2 text-muted-foreground">{d.status === "perdido" ? d.motivo ?? "sem motivo registrado" : ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <OwnerSheet owner={painel} nome={painel ? nome(painel) : ""} deals={deals} cota={selectedKey} cotaNome={cotaNome} onClose={() => setPainel(null)} />
    </Card>
  );
}

function OwnerSheet({ owner, nome, deals, cota, cotaNome, onClose }: { owner: string | null; nome: string; deals: SponsorDealRow[]; cota: string | null; cotaNome?: string; onClose: () => void }) {
  const [aba, setAba] = useState<DealStatusPt>("ganho");
  const meus = owner ? deals.filter((d) => d.owner === owner && (cota == null || d.cotaKey === cota)) : [];
  const st = ownerStats(owner ?? "", meus);
  const de = (s: DealStatusPt) => meus.filter((d) => d.status === s).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const valorDe = (s: DealStatusPt) => de(s).reduce((t, d) => t + (d.valor ?? 0), 0);
  const qtd: Record<DealStatusPt, number> = { ganho: st.cotasVendidas, negociacao: st.emNegociacao, perdido: st.perdidos };
  const itens = de(aba);
  return (
    <Sheet open={owner != null} onOpenChange={(o) => { if (!o) { onClose(); setAba("ganho"); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>
            Conversão {pct(st.conversao)} <span className="text-[11px]">(ganhos ÷ ganhos + perdidos)</span>
            {cotaNome && <span className="block text-[11px]">Só a cota {cotaNome}</span>}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(["ganho", "negociacao", "perdido"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAba(s)}
              aria-pressed={aba === s}
              className={`rounded-xl border p-3 text-left transition-colors ${aba === s ? "border-foreground/40 bg-secondary/50" : "hover:bg-secondary/40"}`}
            >
              <div className={`text-2xl font-semibold tabular-nums ${s === "ganho" ? "text-ok" : s === "perdido" ? "text-bad" : ""}`}>{int(qtd[s])}</div>
              <div className="text-[11px] text-muted-foreground">{s === "ganho" ? "Ganhos" : s === "negociacao" ? "Em negociação" : "Perdidos"}</div>
              <div className="mt-1 text-[11px] font-medium tabular-nums">{brl(valorDe(s))}</div>
            </button>
          ))}
        </div>
        <ul className="mt-4 divide-y">
          {itens.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">Nenhum negócio aqui.</li>
          ) : (
            itens.map((d) => (
              <li key={d.key} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.empresa}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.quantidade > 1 ? `${int(d.quantidade)}× ` : ""}{d.cota} ·{" "}
                    {aba === "ganho" && `fechado em ${dia(d.data)}`}
                    {aba === "negociacao" && `${d.etapa ?? "Etapa não informada"} · ${d.diasNaEtapa == null ? "sem data" : `parado há ${int(d.diasNaEtapa)} ${d.diasNaEtapa === 1 ? "dia" : "dias"}${d.desdeCriacao ? " (desde a criação)" : ""}`}`}
                    {aba === "perdido" && `perdido em ${dia(d.data)}`}
                  </div>
                  {aba === "perdido" && <div className="mt-0.5 text-[11px] italic text-muted-foreground">{d.motivo ?? "sem motivo registrado"}</div>}
                </div>
                <div className="shrink-0 text-right font-semibold tabular-nums">{valor(d.valor)}</div>
              </li>
            ))
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
