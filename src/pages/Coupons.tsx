import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
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
import { CRM_DISCOUNT_HINT, couponForSeller, crmDiscountCoverage } from "@/lib/invoicedTickets";
import { TeamRanking, buildTeamRanking } from "@/components/dashboard/TeamRanking";
import { Kpi, useCouponTotals } from "@/components/dashboard/CouponKpis";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COUPON_GROUPS, couponCodes, couponDiscountValue, couponLabel, formatDiscount, getCouponPeople, outsideTeamBySeller, parseCoupon, personBySeller, type CouponGroup, type CouponKind, type ParsedCoupon } from "@/lib/coupons";
import { cn } from "@/lib/utils";
import { eventGoal } from "@/lib/goalMetrics";
import { useGoals } from "@/hooks/useDashboardData";
import { goalsOfEvent } from "@/hooks/useEvent";

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
  // Mais de um desconto quando vários cupons da mesma pessoa contam como um só.
  discounts: string[];
  uses: number;
  receita: number;
  desconto: number;
}

export default function Coupons() {
  const { isSeller } = useAuth();
  const { event } = useEvent();
  const vendas = useAllTimeTicketSales(event.sympla_event_id ?? "");
  const { data: metas } = useGoals();
  const metaEquipe = eventGoal(goalsOfEvent(metas ?? [], event), "team_sales");
  const totals = useCouponTotals(vendas.data ?? []);
  const [grupo, setGrupo] = useState<CouponGroup | "todos">("todos");
  const [busca, setBusca] = useState("");

  const { paying, bonus } = useMemo(() => splitTickets(vendas.data ?? []), [vendas.data]);
  const ranking = useMemo(() => buildTeamRanking(paying), [paying]);

  const cupons = useMemo(() => {
    const map = new Map<string, CupomLinha>();
    const todos = [...paying, ...bonus];
    const cuponsEquipe = [...new Set([...todos.map((t) => parseCoupon(t.coupon_code)).filter((c) => c?.group === "equipe").map((c) => c!.code), ...getCouponPeople().filter((x) => !x.outsideRanking).flatMap((x) => x.codes.slice(0, 1))])];
    todos.forEach((t) => {
      // Faturado interno (Pipedrive) soma no cupom da equipe de quem vendeu (ex.: Suelen → SUELLEN5), como venda normal.
      let c: ParsedCoupon | null;
      const foraDaEquipe = t.source === "pipedrive" ? outsideTeamBySeller(t.seller ?? t.seller_name) : null;
      if (foraDaEquipe) {
        // Faturado de quem está fora do ranking soma no cupom dela, na Equipe CUPOLA.
        c = { code: foraDaEquipe, discount: null, kind: "desconto", group: "equipe" };
      } else if (t.source === "pipedrive") {
        const cupom = personBySeller(t.seller ?? t.seller_name)?.codes[0] ?? (couponForSeller(t.seller, cuponsEquipe) ?? couponForSeller(t.seller_name, cuponsEquipe));
        const code = cupom ?? String(t.seller_name ?? "Vendedor não informado").toUpperCase();
        c = { code, discount: null, kind: "desconto", group: "equipe" };
      } else c = parseCoupon(t.coupon_code);
      if (!c) return;
      const atual = map.get(c.code) ?? { ...c, discounts: [], uses: 0, receita: 0, desconto: 0 };
      if (!atual.discount && c.discount) atual.discount = c.discount;
      if (c.discount && !atual.discounts.includes(c.discount)) atual.discounts.push(c.discount);
      atual.uses += t.quantity || 0;
      atual.receita += Number(t.total_price || 0);
      atual.desconto += couponDiscountValue(t) + (t.discount_value || 0);
      map.set(c.code, atual);
    });
    return Array.from(map.values()).sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code));
  }, [paying, bonus]);

  // Pagos na Sympla sem nenhum código. Faturado interno não entra: ele não usa cupom na compra.
  const semCupom = useMemo(() => {
    const lista = paying.filter((t) => t.source !== "pipedrive" && !parseCoupon(t.coupon_code));
    return { usos: lista.reduce((s, t) => s + (t.quantity || 0), 0), receita: lista.reduce((s, t) => s + Number(t.total_price || 0), 0) };
  }, [paying]);

  const { gratuitos, descontos, cuponsUsados, comCupom } = totals;
  const cobertura = crmDiscountCoverage(paying);

  const grupos = COUPON_GROUPS.map((g) => ({ ...g, uses: cupons.filter((c) => c.group === g.key).reduce((s, c) => s + c.uses, 0) })).filter((g) => g.uses > 0);
  const grupoAtivo = grupos.some((g) => g.key === grupo) ? grupo : "todos";
  const termo = busca.trim().toUpperCase();
  const visiveis = cupons.filter((c) => (grupoAtivo === "todos" || c.group === grupoAtivo) && (!termo || couponLabel(c.code).toUpperCase().includes(termo) || couponCodes(c.code).includes(termo)));
  const rotuloGrupo = (g: CouponGroup) => COUPON_GROUPS.find((x) => x.key === g)?.label ?? g;

  // Pizza: os 5 cupons mais usados (do filtro atual) e o resto somado em "Outros".
  const pizza = useMemo(() => {
    const top = visiveis.slice(0, 5).map((c) => ({ label: couponLabel(c.code), codes: couponCodes(c.code), value: c.uses }));
    const resto = visiveis.slice(5).reduce((s, c) => s + c.uses, 0);
    return resto > 0 ? [...top, { label: "Outros", value: resto }] : top;
  }, [visiveis]);
  const totalPizza = pizza.reduce((s, p) => s + p.value, 0);

  if (isSeller) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <PageHeader title="Cupons" description="Quem vende com cupom, quanto cada código rendeu e quanto foi abatido do preço." />

      <p role="status" className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Vendas da Sympla e faturados internamente (negócios ganhos no Pipedrive com ingresso do Summit). O faturado soma no ranking de quem está no campo "ID do canal de origem" do negócio.
          {cobertura.faltam > 0 && ` Para investigar no CRM: ${cobertura.faltam} de ${cobertura.negocios} negócios faturados sem desconto preenchido. ${CRM_DISCOUNT_HINT}`}
        </span>
      </p>

      {vendas.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
            <Kpi title="Entradas liberadas" value={int(gratuitos)} hint="ingressos sem cobrança, com cupom de 100%" />
            <Kpi title="Descontos concedidos" value={brl(descontos)} hint={cobertura.negocios ? `cupons parciais e faturados · ${cobertura.comDesconto} de ${cobertura.negocios} faturados com desconto no CRM` : "abatido do preço em cupons parciais"} infoKey="Descontos concedidos" />
            <Kpi title="Códigos em circulação" value={int(cuponsUsados)} hint="cupons diferentes já usados" />
            <Kpi title="Vendas com cupom" value={int(comCupom)} hint="somando todos os tipos de cupom" />
          </div>

          <div className="grid grid-cols-12 gap-[14px]">
            {ranking.lotes.some((l) => l.ranking.length > 0) ? (
              <TeamRanking data={ranking} gerencial metaPorPessoa={metaEquipe ? Number(metaEquipe.target_value) : null} />
            ) : (
              <Card className="col-span-12 p-8 text-center text-sm text-muted-foreground">Ninguém da equipe vendeu com cupom neste evento ainda.</Card>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                Cupons em uso <InfoTip title="Cupons em uso" />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Cada código, o grupo a que pertence e o quanto ele já rendeu.</p>
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
                          <span className="truncate" title={"codes" in p && p.codes ? `Cupom: ${p.codes}` : p.label}>{p.label}</span>
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
                        <TableCell className="font-medium">
                          {couponLabel(c.code) !== c.code ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">{couponLabel(c.code)}</span>
                              </TooltipTrigger>
                              <TooltipContent>Cupom: {couponCodes(c.code)}</TooltipContent>
                            </Tooltip>
                          ) : (
                            c.code
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{rotuloGrupo(c.group)}</TableCell>
                        <TableCell className="tabular-nums">{c.discounts.length > 1 ? c.discounts.map(formatDiscount).join(" / ") : formatDiscount(c.discount)}</TableCell>
                        <TableCell><Chip variant={KIND_CHIP[c.kind].variant}>{KIND_CHIP[c.kind].label}</Chip></TableCell>
                        <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(c.receita)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.desconto > 0 ? brl(c.desconto) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {grupoAtivo === "todos" && !termo && semCupom.usos > 0 && (
                      <TableRow className="bg-secondary/40">
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="font-medium">Sem cupom</TableCell>
                        <TableCell className="text-muted-foreground">Só Sympla</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="text-right tabular-nums">{int(semCupom.usos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl(semCupom.receita)}</TableCell>
                        <TableCell className="text-right">—</TableCell>
                      </TableRow>
                    )}
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
