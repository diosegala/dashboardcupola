import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { useAuth } from "@/hooks/useAuth";
import { useEvent } from "@/hooks/useEvent";
import { useAllTimeTicketSales } from "@/hooks/useDashboardData";
import { splitTickets } from "@/hooks/useCommercialMetrics";
import { TeamRanking, buildTeamRanking, posicaoDe } from "@/components/dashboard/TeamRanking";
import { Kpi, useCouponTotals } from "@/components/dashboard/CouponKpis";
import { COUPON_GROUPS, couponDiscountValue, formatDiscount, parseCoupon, type CouponGroup, type CouponKind } from "@/lib/coupons";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KIND_CHIP: Record<CouponKind, { label: string; variant: "paid" | "neutral" | "lavender" }> = {
  faturado: { label: "Faturado", variant: "paid" },
  cortesia: { label: "Cortesia", variant: "neutral" },
  desconto: { label: "Desconto", variant: "lavender" },
};

const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-3))", "hsl(var(--muted-foreground))"];

interface CupomLinha {
  code: string;
  discount: string | null;
  kind: CouponKind;
  group: CouponGroup;
  uses: number;
  receita: number;
  desconto: number;
}

export default function Coupons() {
  const { isSeller } = useAuth();
  const { event } = useEvent();
  const vendas = useAllTimeTicketSales(event.sympla_event_id ?? "");
  const totals = useCouponTotals(vendas.data ?? []);
  const [grupo, setGrupo] = useState<CouponGroup | "todos">("todos");
  const [busca, setBusca] = useState("");

  const { paying, bonus } = useMemo(() => splitTickets(vendas.data ?? []), [vendas.data]);
  const ranking = useMemo(() => buildTeamRanking(paying), [paying]);

  const cupons = useMemo(() => {
    const map = new Map<string, CupomLinha>();
    [...paying, ...bonus].forEach((t) => {
      const c = parseCoupon(t.coupon_code);
      if (!c) return;
      const atual = map.get(c.code) ?? { ...c, uses: 0, receita: 0, desconto: 0 };
      atual.uses += t.quantity || 0;
      atual.receita += Number(t.total_price || 0);
      atual.desconto += couponDiscountValue(t);
      map.set(c.code, atual);
    });
    return Array.from(map.values()).sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code));
  }, [paying, bonus]);

  const { gratuitos, descontos, cuponsUsados, comCupom } = totals;

  const grupos = COUPON_GROUPS.map((g) => ({ ...g, uses: cupons.filter((c) => c.group === g.key).reduce((s, c) => s + c.uses, 0) })).filter((g) => g.uses > 0);
  const grupoAtivo = grupos.some((g) => g.key === grupo) ? grupo : "todos";
  const termo = busca.trim().toUpperCase();
  const visiveis = cupons.filter((c) => (grupoAtivo === "todos" || c.group === grupoAtivo) && (!termo || c.code.includes(termo)));
  const rotuloGrupo = (g: CouponGroup) => COUPON_GROUPS.find((x) => x.key === g)?.label ?? g;

  // Pizza: os 5 cupons mais usados (do filtro atual) e o resto somado em "Outros".
  const pizza = useMemo(() => {
    const top = visiveis.slice(0, 5).map((c) => ({ label: c.code, value: c.uses }));
    const resto = visiveis.slice(5).reduce((s, c) => s + c.uses, 0);
    return resto > 0 ? [...top, { label: "Outros", value: resto }] : top;
  }, [visiveis]);
  const totalPizza = pizza.reduce((s, p) => s + p.value, 0);

  // Histórico: pódio de cada lote encerrado.
  const historico = ranking.lotes.filter((l) => l.lote !== ranking.loteAtual && l.ranking.length > 0);

  if (isSeller) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <PageHeader title="Cupons" description="Uso dos cupons no evento, ranking da equipe e histórico de ganhadores por lote." />

      {vendas.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
            <Kpi title="Cupons gratuitos" value={int(gratuitos)} hint="ingressos com cupom de 100%" />
            <Kpi title="Descontos concedidos" value={brl(descontos)} hint="só cupons menores que 100%" />
            <Kpi title="Cupons usados" value={int(cupons.length)} hint="códigos diferentes" />
            <Kpi title="Ingressos com cupom" value={int(comCupom)} />
          </div>

          <div className="grid grid-cols-12 gap-[14px]">
            {ranking.lotes.some((l) => l.ranking.length > 0) ? (
              <TeamRanking data={ranking} gerencial className="lg:col-span-8" />
            ) : (
              <Card className="col-span-12 p-8 text-center text-sm text-muted-foreground lg:col-span-8">Ninguém da equipe vendeu com cupom neste evento ainda.</Card>
            )}
            <Card className="col-span-12 lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Histórico de ganhadores <InfoTip title="Histórico de ganhadores" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aparece quando o primeiro lote com vendas da equipe for encerrado.</p>
                ) : (
                  <ul className="space-y-4">
                    {historico.map((l) => (
                      <li key={l.lote}>
                        <div className="mb-1.5 text-[13px] font-semibold">{l.lote}</div>
                        <ol className="space-y-1">
                          {l.ranking.filter((v) => posicaoDe(l.ranking, v) <= 3).map((v) => {
                            const pos = posicaoDe(l.ranking, v);
                            return (
                              <li key={v.nome} className="flex items-center justify-between gap-2 text-[13px]">
                                <span className={cn("flex items-center gap-2", pos === 1 && "font-semibold")}>
                                  <span className="w-6 text-muted-foreground tabular-nums">{pos}º</span>
                                  {v.nome}
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                  <b className="font-semibold text-foreground">{int(v.vendas)}</b> · {brl(v.receita)}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                Ranking de cupons <InfoTip title="Ranking de cupons" />
              </CardTitle>
              <div className="!mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex w-fit flex-wrap items-center gap-0.5 rounded-[18px] border bg-secondary p-1">
                  {[{ key: "todos" as const, label: "Todos", uses: comCupom }, ...grupos].map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGrupo(g.key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150",
                        grupoAtivo === g.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground",
                      )}
                    >
                      {g.label} <span className="tabular-nums opacity-70">{int(g.uses)}</span>
                    </button>
                  ))}
                </div>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cupom" className="h-9 w-full max-w-[220px] rounded-full bg-card" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              {pizza.length > 0 ? (
                <div className="space-y-3">
                  <div className="relative mx-auto h-[180px] w-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pizza} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                          {pizza.map((p, i) => <Cell key={p.label} fill={CORES[i % CORES.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div>
                        <div className="text-xl font-semibold leading-none">{int(totalPizza)}</div>
                        <div className="mt-1 text-[10px] leading-tight text-muted-foreground">usos</div>
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {pizza.map((p, i) => (
                      <li key={p.label} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CORES[i % CORES.length] }} />
                          <span className="truncate" title={p.label}>{p.label}</span>
                        </span>
                        <b className="tabular-nums">{int(p.value)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <div />}
              <div className="max-h-[480px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Cupom</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Usos</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Desconto (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveis.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Nenhum cupom encontrado.</TableCell></TableRow>
                    ) : visiveis.map((c, i) => (
                      <TableRow key={c.code}>
                        <TableCell className="tabular-nums text-muted-foreground">{i + 1}º</TableCell>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell className="text-muted-foreground">{rotuloGrupo(c.group)}</TableCell>
                        <TableCell className="tabular-nums">{formatDiscount(c.discount)}</TableCell>
                        <TableCell><Chip variant={KIND_CHIP[c.kind].variant}>{KIND_CHIP[c.kind].label}</Chip></TableCell>
                        <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(c.receita)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.desconto > 0 ? brl(c.desconto) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
