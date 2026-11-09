import { useMemo, useState } from "react";
import { ChevronDown, Heart, Ticket, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VizCard, VIZ } from "@/components/buyers/profile/ProfileViz";
import type { Company, EventRef } from "@/lib/buyers";
import { cn } from "@/lib/utils";

const int = (n: number) => n.toLocaleString("pt-BR");
const PASSO = 10;

interface Linha {
  c: Company;
  eventos: number;
  pagos: number;
  agora: number;
  estreante: boolean;
}

// Empresas que estão no evento selecionado, ranqueadas pela fidelidade à CUPOLA: em quantos eventos já vieram,
// depois quantos ingressos pagos somam em todos eles e quantas pessoas trouxeram agora.
export function CompanyRanking({ companies, eventos, eventSlug }: { companies: Company[]; eventos: EventRef[]; eventSlug: string }) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(PASSO);
  const [aberto, setAberto] = useState(false);

  const linhas = useMemo<Linha[]>(
    () =>
      companies
        .filter((c) => c.events[eventSlug])
        .map((c) => {
          const evs = Object.values(c.events);
          return {
            c,
            eventos: evs.length,
            pagos: evs.reduce((s, e) => s + e.paid, 0),
            agora: c.events[eventSlug].people.size,
            estreante: evs.length === 1,
          };
        })
        .sort((a, b) => b.eventos - a.eventos || b.pagos - a.pagos || b.agora - a.agora || a.c.name.localeCompare(b.c.name, "pt-BR")),
    [companies, eventSlug],
  );

  if (linhas.length === 0) return null;

  const veteranas = linhas.filter((l) => !l.estreante).length;
  const melhor = (f: (l: Linha) => number) => [...linhas].sort((a, b) => f(b) - f(a) || b.eventos - a.eventos)[0];
  const trofeus = [
    { titulo: "Mais fiel", icone: Heart, cor: VIZ[2], l: melhor((l) => l.eventos * 1000 + l.pagos), valor: (l: Linha) => `${int(l.eventos)} ${l.eventos === 1 ? "evento" : "eventos"} CUPOLA` },
    { titulo: "Maior delegação", icone: UsersRound, cor: VIZ[0], l: melhor((l) => l.agora), valor: (l: Linha) => `${int(l.agora)} ${l.agora === 1 ? "pessoa" : "pessoas"} neste evento` },
    { titulo: "Mais ingressos pagos", icone: Ticket, cor: VIZ[3], l: melhor((l) => l.pagos), valor: (l: Linha) => `${int(l.pagos)} pagos em todos os eventos` },
  ];

  const termo = busca.trim().toLowerCase();
  const posicao = new Map(linhas.map((l, i) => [l.c.id, i + 1]));
  const lista = termo ? linhas.filter((l) => l.c.name.toLowerCase().includes(termo) || (l.c.cnpj ?? "").includes(termo.replace(/\D/g, "") || "#")) : linhas;

  return (
    <VizCard
      title="Empresas da casa"
      subtitle={`${int(linhas.length)} empresas neste evento: ${int(veteranas)} já vieram a outros eventos CUPOLA e ${int(linhas.length - veteranas)} estreiam agora.`}
      className="col-span-12"
    >
      {/* Veteranas x estreantes numa barra só */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
        <i className="block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both]" style={{ width: `${(veteranas / linhas.length) * 100}%`, background: VIZ[1] }} title={`Veteranas: ${int(veteranas)}`} />
        <i className="block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] border-l-2 border-card" style={{ width: `${((linhas.length - veteranas) / linhas.length) * 100}%`, background: VIZ[4], animationDelay: "200ms" }} title={`Estreantes: ${int(linhas.length - veteranas)}`} />
      </div>
      <div className="-mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: VIZ[1] }} /> Veteranas</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[2px]" style={{ background: VIZ[4] }} /> Estreantes</span>
      </div>

      {/* Três troféus, cada um com um jeito diferente de ser importante para a CUPOLA */}
      <div className="grid gap-3 sm:grid-cols-3">
        {trofeus.map((t, n) => (
          <div
            key={t.titulo}
            className="relative animate-[pop-in_600ms_cubic-bezier(.16,1,.3,1)_both] overflow-hidden rounded-2xl border p-4"
            style={{ background: `color-mix(in oklab, ${t.cor} 9%, hsl(var(--card)))`, animationDelay: `${n * 120}ms` }}
          >
            <t.icone className="absolute -right-3 -top-3 h-20 w-20 opacity-[0.09]" style={{ color: t.cor }} aria-hidden />
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: t.cor }}>
              <t.icone className="h-4 w-4" /> {t.titulo}
            </div>
            <div className="mt-2 truncate text-[17px] font-semibold tracking-[-0.01em]" title={t.l.c.name}>{t.l.c.name}</div>
            <div className="text-xs text-muted-foreground">{t.valor(t.l)}</div>
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-fit rounded-full" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        Ranking de fidelidade
        <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      </Button>

      {aberto && (
        <>
          <Input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(PASSO); }} placeholder="Achar empresa ou CNPJ" className="h-9 max-w-[240px] rounded-full" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Eventos CUPOLA</TableHead>
                <TableHead className="text-right">Pessoas neste evento</TableHead>
                <TableHead className="text-right">Ingressos pagos (todos os eventos)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.slice(0, limite).map((l) => (
                <TableRow key={l.c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{posicao.get(l.c.id)}</TableCell>
                  <TableCell className="font-medium">
                    {l.c.name}
                    {l.estreante && <span className="ml-2 text-xs font-normal text-muted-foreground">Estreante</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{int(l.eventos)} de {int(eventos.length)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(l.agora)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(l.pagos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa com esse nome neste evento.</p>}
          {lista.length > limite && (
            <Button variant="outline" className="w-fit self-center rounded-full" onClick={() => setLimite((n) => n + PASSO)}>
              Ver mais {int(Math.min(PASSO, lista.length - limite))}
            </Button>
          )}
        </>
      )}
    </VizCard>
  );
}
