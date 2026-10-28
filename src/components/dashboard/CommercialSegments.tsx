import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { COUPON_GROUPS, formatDiscount, parseCoupon, type CouponGroup, type CouponKind } from "@/lib/coupons";
import { TeamRanking, buildTeamRanking, findMe } from "@/components/dashboard/TeamRanking";
import { useAuth } from "@/hooks/useAuth";
import { useMyTeamCoupons } from "@/hooks/useTeam";
import { eventGoal } from "@/lib/goalMetrics";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

const REGIAO_POR_UF: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const PAGAMENTO: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BOLETO: "Boleto",
  BOLETO_BANCARIO: "Boleto",
  BANK_SLIP: "Boleto",
  PIX: "Pix",
  FREE: "Gratuito",
  MANUAL: "Manual",
};

function pagamentoDe(valor: string): string {
  return PAGAMENTO[valor.trim().toUpperCase()] ?? valor;
}

export interface FormAnswerCount {
  question: string;
  answer: string;
  total: number;
}

export function regiaoDe(estado: string): string {
  const uf = estado.trim().toUpperCase().slice(-2);
  return REGIAO_POR_UF[uf] ?? "Outros";
}

const KIND_CHIP: Record<CouponKind, { label: string; variant: "paid" | "neutral" | "lavender" }> = {
  faturado: { label: "Faturado", variant: "paid" },
  cortesia: { label: "Cortesia", variant: "neutral" },
  desconto: { label: "Desconto", variant: "lavender" },
};

export function countBy(tickets: Ticket[], key: (t: Ticket) => string | null | undefined) {
  const map = new Map<string, number>();
  tickets.forEach((t) => {
    const k = key(t);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + (t.quantity || 0));
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// Barras horizontais do ds-summit: crescem da esquerda; no hover a barra fica lima e as outras esmaecem.
export function HBars({ items }: { items: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((i) => (
        <div
          key={i.label}
          onMouseEnter={() => setHover(i.label)}
          onMouseLeave={() => setHover(null)}
          className={cn("transition-opacity duration-150", hover && hover !== i.label && "opacity-40")}
        >
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate">{i.label}</span>
            <b className="font-semibold tabular-nums">{int(i.value)}</b>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <i
              className={cn(
                "block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full transition-colors duration-150 motion-reduce:animate-none",
                hover === i.label ? "bg-primary" : "bg-data-blue",
              )}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const CORES_PARTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))"];

// Barra única de 100% dividida em partes, com legenda de quantidade e %. Cabe quantas opções aparecerem.
export function ShareBar({ items }: { items: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
        {items.map((i, n) => (
          <i
            key={i.label}
            onMouseEnter={() => setHover(i.label)}
            onMouseLeave={() => setHover(null)}
            title={`${i.label}: ${int(i.value)} (${pct(i.value)})`}
            className={cn("block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] transition-opacity duration-150 motion-reduce:animate-none", hover && hover !== i.label && "opacity-35")}
            style={{ width: `${(i.value / total) * 100}%`, background: CORES_PARTE[n % CORES_PARTE.length] }}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {items.map((i, n) => (
          <li
            key={i.label}
            onMouseEnter={() => setHover(i.label)}
            onMouseLeave={() => setHover(null)}
            className={cn("flex items-center justify-between gap-3 rounded-xl px-2 py-1 text-[13px] transition-[background-color,opacity] duration-150 hover:bg-secondary", hover && hover !== i.label && "opacity-45")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CORES_PARTE[n % CORES_PARTE.length] }} />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <b className="font-semibold">{int(i.value)}</b>
              <span className="ml-2 text-muted-foreground">{pct(i.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// UTM às vezes vem como códigos de letra ("(99,97,110,...)"): converte de volta para texto.
function utmLabel(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const codes = t.match(/^[({[]?\s*(\d{2,3}(?:\s*,\s*\d{2,3})+)\s*[)}\]]?$/);
  return codes ? String.fromCharCode(...codes[1].split(",").map((n) => Number(n.trim()))) : t;
}

function SegmentCard({ title, items, className, share }: { title: string; items: { label: string; value: number }[]; className?: string; share?: boolean }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {title} <InfoTip title={title} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {share ? <ShareBar items={items} /> : <HBars items={items} />}
      </CardContent>
    </Card>
  );
}

interface CommercialSegmentsProps {
  tickets: Ticket[];
  goals?: any[];
}

// Forma de pagamento, origem da venda e cupons. O perfil de quem compra fica na página Compradores.
export function CommercialSegments({ tickets, goals = [] }: CommercialSegmentsProps) {
  const { paying, bonus } = useMemo(() => splitTickets(tickets), [tickets]);
  const { profile } = useAuth();
  const meusCupons = useMyTeamCoupons();
  const ranking = useMemo(() => buildTeamRanking(paying), [paying]);
  const eu = useMemo(() => findMe(ranking, meusCupons.data ?? [], profile?.name), [ranking, meusCupons.data, profile?.name]);

  const porPagamento = useMemo(() => countBy(paying, (t) => (t.payment_method ? pagamentoDe(t.payment_method) : null)), [paying]);
  const porOrigem = useMemo(() => countBy(paying, (t) => utmLabel(t.utm_source)).slice(0, 8), [paying]);

  // Cupons agrupados pelo código, com o desconto e o tipo enviados pela Sympla.
  const cupons = useMemo(() => {
    const map = new Map<string, { code: string; discount: string | null; kind: CouponKind; group: CouponGroup; uses: number }>();
    [...paying, ...bonus].forEach((t) => {
      const c = parseCoupon(t.coupon_code);
      if (!c) return;
      const atual = map.get(c.code) ?? { ...c, uses: 0 };
      atual.uses += t.quantity || 0;
      map.set(c.code, atual);
    });
    return Array.from(map.values()).sort((a, b) => b.uses - a.uses);
  }, [paying, bonus]);

  // Filtro por grupo: só mostra os grupos que têm cupom usado.
  const [grupo, setGrupo] = useState<CouponGroup | "todos">("todos");
  const grupos = COUPON_GROUPS.map((g) => ({ ...g, uses: cupons.filter((c) => c.group === g.key).reduce((s, c) => s + c.uses, 0) })).filter((g) => g.uses > 0);
  const grupoAtivo = grupos.some((g) => g.key === grupo) ? grupo : "todos";
  const cuponsVisiveis = grupoAtivo === "todos" ? cupons : cupons.filter((c) => c.group === grupoAtivo);
  const rotuloGrupo = (g: CouponGroup) => COUPON_GROUPS.find((x) => x.key === g)?.label ?? g;

  const filtro = (key: CouponGroup | "todos", rotulo: string, usos: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setGrupo(key)}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150",
        grupoAtivo === key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {rotulo} <span className="tabular-nums opacity-70">{int(usos)}</span>
    </button>
  );

  const segmentos = [
    { title: "Pagantes por forma de pagamento", items: porPagamento, share: true },
    { title: "Pagantes por origem (UTM)", items: porOrigem },
  ].filter((s) => s.items.length > 0);

  if (segmentos.length === 0 && cupons.length === 0) return null;

  const span = segmentos.length === 1 ? "lg:col-span-12" : segmentos.length % 2 === 0 ? "lg:col-span-6" : "lg:col-span-4";

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      {segmentos.map((s) => (
        <SegmentCard key={s.title} title={s.title} items={s.items} share={"share" in s && s.share} className={cn("col-span-12", span)} />
      ))}

      <TeamRanking data={ranking} eu={eu} metaPorPessoa={Number(eventGoal(goals, "team_sales")?.target_value ?? 0)} />

      {cupons.length > 0 && (
        <Card className="col-span-12">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Cupons <InfoTip title="Cupons" />
            </CardTitle>
            <div className="!mt-3 inline-flex w-fit flex-wrap items-center gap-0.5 rounded-[18px] border bg-secondary p-1">
              {filtro("todos", "Todos", cupons.reduce((s, c) => s + c.uses, 0))}
              {grupos.map((g) => filtro(g.key, g.label, g.uses))}
            </div>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuponsVisiveis.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell className="text-muted-foreground">{rotuloGrupo(c.group)}</TableCell>
                    <TableCell className="tabular-nums">{formatDiscount(c.discount)}</TableCell>
                    <TableCell>
                      <Chip variant={KIND_CHIP[c.kind].variant}>{KIND_CHIP[c.kind].label}</Chip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
