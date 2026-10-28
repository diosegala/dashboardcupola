import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subDays } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Flame, Trophy, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import { TEAM_DISCOUNT, parseCoupon, teamMemberName } from "@/lib/coupons";
import { batchOf, batchOrder } from "@/lib/batches";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Vendedor {
  nome: string;
  cupons: string[];
  vendas: number;
  // Vendas dos últimos 7 dias, para comparar o ritmo.
  recentes: number;
}

export interface TeamRankingData {
  lotes: { lote: string; ranking: Vendedor[] }[];
  loteAtual: string | null;
  campeoes: { nome: string; cupons: string[]; lotes: string[] }[];
}

// Posição com empate: quem tem as mesmas vendas fica na mesma colocação.
export const posicaoDe = (ranking: Vendedor[], v: Vendedor) => 1 + ranking.filter((x) => x.vendas > v.vendas).length;

// Ranking da equipe por lote, a partir das vendas pagantes. O lote atual é o da venda mais recente do evento.
export function buildTeamRanking(paying: Ticket[]): TeamRankingData {
  const porLote = new Map<string, Map<string, Vendedor>>();
  const limiteRecente = subDays(new Date(), 7).toISOString();
  let ultimaVenda = "";
  let loteAtual: string | null = null;

  paying.forEach((t) => {
    const lote = batchOf(t.ticket_type);
    if (!lote) return;
    if ((t.sold_at ?? "") >= ultimaVenda) {
      ultimaVenda = t.sold_at ?? "";
      loteAtual = lote;
    }
    const c = parseCoupon(t.coupon_code);
    if (c?.group !== "equipe") return;
    const nome = teamMemberName(c.code);
    const pessoas = porLote.get(lote) ?? new Map<string, Vendedor>();
    const v = pessoas.get(nome) ?? { nome, cupons: [], vendas: 0, recentes: 0 };
    if (!v.cupons.includes(c.code)) v.cupons.push(c.code);
    v.vendas += t.quantity || 0;
    if ((t.sold_at ?? "") >= limiteRecente) v.recentes += t.quantity || 0;
    pessoas.set(nome, v);
    porLote.set(lote, pessoas);
  });

  if (loteAtual && !porLote.has(loteAtual)) porLote.set(loteAtual, new Map());
  const lotes = Array.from(porLote.entries())
    .map(([lote, pessoas]) => ({
      lote,
      ranking: Array.from(pessoas.values())
        .filter((v) => v.vendas > 0)
        .sort((a, b) => b.vendas - a.vendas || a.nome.localeCompare(b.nome)),
    }))
    .sort((a, b) => batchOrder(a.lote) - batchOrder(b.lote));

  // Campeões: quem liderou cada lote já encerrado (empates contam para todos).
  const map = new Map<string, { nome: string; cupons: string[]; lotes: string[] }>();
  lotes
    .filter((l) => l.lote !== loteAtual && l.ranking.length > 0)
    .forEach((l) => {
      const topo = l.ranking[0].vendas;
      l.ranking
        .filter((v) => v.vendas === topo)
        .forEach((v) => {
          const c = map.get(v.nome) ?? { nome: v.nome, cupons: [], lotes: [] };
          v.cupons.forEach((code) => !c.cupons.includes(code) && c.cupons.push(code));
          c.lotes.push(l.lote);
          map.set(v.nome, c);
        });
    });
  const campeoes = Array.from(map.values()).sort((a, b) => b.lotes.length - a.lotes.length || a.nome.localeCompare(b.nome));

  return { lotes, loteAtual, campeoes };
}

// Quem é a pessoa logada no ranking: pelo cupom cadastrado; sem cadastro, pelo primeiro nome (se só um cupom bater).
export function findMe(data: TeamRankingData, meusCupons: string[], nomePerfil: string | null | undefined) {
  const pessoas = new Map<string, string[]>();
  data.lotes.forEach((l) => l.ranking.forEach((v) => pessoas.set(v.nome, [...new Set([...(pessoas.get(v.nome) ?? []), ...v.cupons])])));
  if (meusCupons.length > 0) {
    const achada = Array.from(pessoas.entries()).find(([, cupons]) => cupons.some((c) => meusCupons.includes(c)));
    return { nome: achada?.[0] ?? teamMemberName(meusCupons[0]), cupons: meusCupons };
  }
  const primeiro = sem((nomePerfil ?? "").trim().split(/\s+/)[0] ?? "");
  const candidatos = primeiro ? Array.from(pessoas.entries()).filter(([nome]) => sem(nome) === primeiro) : [];
  return candidatos.length === 1 ? { nome: candidatos[0][0], cupons: candidatos[0][1] } : null;
}

type Eu = ReturnType<typeof findMe>;

function NomeComCupom({ nome, cupons, className }: { nome: string; cupons: string[]; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("cursor-default truncate", className)}>{nome}</span>
      </TooltipTrigger>
      <TooltipContent>{cupons.join(", ")}</TooltipContent>
    </Tooltip>
  );
}

// Ranking da equipe CUPOLA: recomeça a cada lote. Só aparece quem vendeu. Quem está logado aparece destacado.
// metaPorPessoa: meta de vendas de cada pessoa no lote (tela Metas). Sem meta, as barras ficam sem marca.
export function TeamRanking({ data, eu, metaPorPessoa, className }: { data: TeamRankingData; eu?: Eu; metaPorPessoa?: number | null; className?: string }) {
  const { lotes, loteAtual, campeoes } = data;
  const indiceAtual = Math.max(lotes.findIndex((l) => l.lote === loteAtual), 0);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const indice = escolhido !== null && escolhido < lotes.length ? escolhido : indiceAtual;
  const lote = lotes[indice];

  if (!lotes.some((l) => l.ranking.length > 0)) return null;

  const meta = metaPorPessoa && metaPorPessoa > 0 ? metaPorPessoa : null;
  const max = Math.max(...(lote?.ranking.map((v) => v.vendas) ?? [1]), meta ?? 0, 1);

  return (
    <Card className={cn("col-span-12", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Ranking da equipe <InfoTip title="Ranking da equipe" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Lote anterior" disabled={indice <= 0} onClick={() => setEscolhido(indice - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[110px] text-center text-sm font-semibold">{lote?.lote}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Próximo lote" disabled={indice >= lotes.length - 1} onClick={() => setEscolhido(indice + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {lote?.lote === loteAtual && <span className="ml-1 text-xs text-muted-foreground">lote atual</span>}
            {meta && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <i className="inline-block h-3 w-[2px] rounded-full bg-foreground/45" /> Meta {int(meta)} por pessoa
              </span>
            )}
          </div>

          {lote && lote.ranking.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {lote.ranking.map((v) => {
                const pos = posicaoDe(lote.ranking, v);
                const souEu = eu?.nome === v.nome;
                return (
                  <li
                    key={v.nome}
                    className={cn("grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-2xl px-2 py-1.5", souEu && "bg-primary/15 ring-1 ring-primary/60")}
                  >
                    <span className={cn("text-center text-sm font-semibold tabular-nums", pos === 1 ? "text-foreground" : "text-muted-foreground")}>{pos}º</span>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <NomeComCupom nome={v.nome} cupons={v.cupons} className={pos === 1 || souEu ? "font-semibold" : undefined} />
                          {souEu && <Chip variant="paid" dot={false} className="px-2 py-0.5 text-[11px]">Você</Chip>}
                        </span>
                        <b className="font-semibold tabular-nums">{int(v.vendas)}</b>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-secondary">
                        <i
                          className={cn(
                            "block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full motion-reduce:animate-none",
                            pos === 1 || souEu ? "bg-primary" : "bg-data-blue",
                          )}
                          style={{ width: `${(v.vendas / max) * 100}%` }}
                        />
                        {meta && (
                          <span
                            className="absolute -top-[3px] h-4 w-[2px] rounded-full bg-foreground/45"
                            style={{ left: `calc(${(meta / max) * 100}% - 1px)` }}
                            title={`Meta: ${int(meta)} por pessoa`}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguém da equipe vendeu neste lote ainda.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-secondary/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
            <Trophy className="h-4 w-4" /> Quem mais venceu lotes
          </div>
          {campeoes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {campeoes.map((c) => (
                <li key={c.nome} className="flex items-center justify-between gap-3 text-[13px]">
                  <NomeComCupom nome={c.nome} cupons={c.cupons} className={eu?.nome === c.nome ? "font-semibold" : undefined} />
                  <span className="shrink-0 text-muted-foreground" title={c.lotes.join(", ")}>
                    <b className="font-semibold text-foreground tabular-nums">{c.lotes.length}</b> {c.lotes.length === 1 ? "lote" : "lotes"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Aparece quando o primeiro lote com vendas da equipe virar.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const plural = (n: number, um: string, varios: string) => `${int(n)} ${n === 1 ? um : varios}`;

// Painel da pessoa da equipe: onde ela está no lote atual, quanto falta para subir e o que fazer agora.
export function TeamStanding({ data, eu, eventName }: { data: TeamRankingData; eu: Eu; eventName: string }) {
  const lote = data.lotes.find((l) => l.lote === data.loteAtual);
  const ranking = lote?.ranking ?? [];
  const minha = eu ? ranking.find((v) => v.nome === eu.nome) : undefined;
  const pos = minha ? posicaoDe(ranking, minha) : null;
  const lider = ranking[0];
  const vitorias = eu ? data.campeoes.find((c) => c.nome === eu.nome)?.lotes.length ?? 0 : 0;
  const cupom = eu?.cupons[0];

  // Quanto falta para passar a pessoa logo acima (ou o líder, se já estiver perto).
  const acima = minha ? [...ranking].reverse().find((v) => v.vendas > minha.vendas) : undefined;
  const segundo = minha && pos === 1 ? ranking.find((v) => v.nome !== minha.nome) : undefined;
  const empatados = minha ? ranking.filter((v) => v.nome !== minha.nome && v.vendas === minha.vendas) : [];

  let mensagem: string;
  if (!eu) mensagem = "Ainda não encontramos seu cupom. Peça para cadastrarem seu cupom em Configurações.";
  else if (!minha) mensagem = lider ? `Uma venda já coloca você no ranking. Quem lidera tem ${plural(lider.vendas, "venda", "vendas")}.` : "Ninguém vendeu neste lote ainda: a primeira venda já coloca você na liderança.";
  else if (pos === 1 && empatados.length > 0) mensagem = `Empate na liderança com ${empatados.map((v) => v.nome).join(", ")}. Uma venda desempata.`;
  else if (pos === 1) mensagem = segundo ? `Você lidera com ${plural(minha.vendas - segundo.vendas, "venda", "vendas")} de vantagem sobre ${segundo.nome}.` : "Você lidera este lote.";
  else if (acima) {
    const faltam = acima.vendas - minha.vendas + 1;
    mensagem = `Faltam ${plural(faltam, "venda", "vendas")} para passar ${acima.nome}${lider && lider.nome !== acima.nome ? ` e ${plural(lider.vendas - minha.vendas + 1, "venda", "vendas")} para a liderança` : ""}.`;
  } else mensagem = "Continue: cada venda conta.";

  const copiarConvite = async () => {
    if (!cupom) return;
    const texto = `Garanta seu ingresso para o ${eventName} com ${TEAM_DISCOUNT}% de desconto usando o meu cupom ${cupom}.`;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Convite copiado", { description: "Cole no WhatsApp, no e-mail ou onde preferir." });
    } catch {
      toast.error("Não deu para copiar", { description: texto });
    }
  };

  const ritmo = minha && lider && lider.nome !== minha.nome
    ? `Nos últimos 7 dias, ${lider.nome} vendeu ${int(lider.recentes)} e você ${int(minha.recentes)}.`
    : minha
      ? `Você vendeu ${plural(minha.recentes, "ingresso", "ingressos")} nos últimos 7 dias.`
      : "O ranking zera quando o lote vira: cada lote é uma nova chance.";

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      <Card className="col-span-12 flex flex-col justify-between gap-5 bg-foreground p-6 text-background lg:col-span-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-background/70">
          Sua posição · {data.loteAtual ?? "lote atual"}
        </div>
        <div className="flex items-end gap-4">
          <span className="text-[clamp(56px,7vw,84px)] font-semibold leading-none tracking-[-0.05em] text-primary">{pos ? `${pos}º` : "—"}</span>
          <span className="pb-2 text-sm text-background/70">
            {minha ? <>de {int(ranking.length)} na equipe<br /><b className="text-background">{plural(minha.vendas, "venda", "vendas")}</b> neste lote</> : "sem vendas neste lote"}
          </span>
        </div>
        <p className="text-[15px] leading-snug">{mensagem}</p>
        {vitorias > 0 && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 text-xs font-semibold">
            <Trophy className="h-3.5 w-3.5 text-primary" /> Você já venceu {plural(vitorias, "lote", "lotes")}
          </span>
        )}
      </Card>

      <div className="col-span-12 grid gap-[14px] sm:grid-cols-3 lg:col-span-7">
        <Card className="flex flex-col gap-3 p-5">
          <UsersRound className="h-5 w-5 text-data-blue" />
          <div className="text-[13px] font-semibold">Chame quem já veio</div>
          <p className="flex-1 text-[13px] text-muted-foreground">Quem participou de edições anteriores e ainda não comprou é o caminho mais curto para a próxima venda.</p>
          <Button asChild variant="outline" size="sm" className="w-fit rounded-full">
            <Link to="/compradores">Abrir a lista</Link>
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <Copy className="h-5 w-5 text-data-blue" />
          <div className="text-[13px] font-semibold">Seu cupom {cupom && <span className="font-mono">{cupom}</span>}</div>
          <p className="flex-1 text-[13px] text-muted-foreground">
            {cupom ? `Dá ${TEAM_DISCOUNT}% de desconto. Toda venda com ele conta para você.` : "Seu cupom ainda não foi cadastrado."}
          </p>
          <Button variant="outline" size="sm" className="w-fit rounded-full" disabled={!cupom} onClick={copiarConvite}>
            Copiar convite
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <Flame className="h-5 w-5 text-data-blue" />
          <div className="text-[13px] font-semibold">Ritmo</div>
          <p className="flex-1 text-[13px] text-muted-foreground">{ritmo}</p>
          <p className="text-xs text-muted-foreground">O ranking recomeça a cada lote.</p>
        </Card>
      </div>
    </div>
  );
}
