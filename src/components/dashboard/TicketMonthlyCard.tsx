import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { VALOR_LIQUIDO_SYMPLA } from "@/lib/metricInfo";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InfoTip } from "@/components/InfoTip";
import { ChartLegend } from "./charts/ChartLegend";
import { PREVIOUS_YEAR_KEY, previousYearLineProps, useSeriesVisibility } from "./charts/chartSeries";
import { useCompare } from "@/hooks/useCompare";
import { rotuloMes, type TicketMonth } from "@/lib/monthlyRevenue";
import { cn } from "@/lib/utils";

const COR_SYMPLA = "hsl(var(--chart-1))";
const COR_FATURADO = "hsl(var(--chart-2))";
const COR_META = "hsl(var(--warn))";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const eixo = (n: number) => (n >= 1000 ? `R$ ${Math.round(n / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(n)}`);
const int = (n: number) => n.toLocaleString("pt-BR");

// Faturamento de ingressos mês a mês: Sympla e faturados empilhados, acumulado, quantidade e ano anterior.
export function TicketMonthlyCard({ className, meses, filtrado }: { className?: string; meses: TicketMonth[]; filtrado?: boolean }) {
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const { ativo: comparar, rotulo } = useCompare();
  const series = useSeriesVisibility();
  const temAnterior = meses.some((m) => m.anoAnterior !== null);
  const mostrarAnterior = comparar && temAnterior;
  const temMeta = meses.some((m) => m.meta !== null);
  const dados = meses.map((m) => ({
    ...m,
    nome: `${rotuloMes(m.mes, true)}${m.parcial ? " · parcial" : ""}`,
    [PREVIOUS_YEAR_KEY]: m.anoAnterior,
  }));
  const total = meses.reduce((s, m) => s + m.total, 0);
  const totalSympla = meses.reduce((s, m) => s + m.sympla, 0);
  const totalFaturado = meses.reduce((s, m) => s + m.faturado, 0);
  const ingressos = meses.reduce((s, m) => s + m.ingressos, 0);
  const melhor = meses.reduce<TicketMonth | null>((b, m) => (m.total > (b?.total ?? 0) ? m : b), null);
  // A tabela para no último mês com venda ou no mês atual; o gráfico segue até o mês do evento.
  const linhas = meses.filter((m) => !m.futuro || m.total > 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Faturamento de ingressos por mês
            <InfoTip
              title="Faturamento de ingressos por mês"
              text={`Quanto foi vendido em ingressos em cada mês. Sympla conta pela data da compra e faturados internos pela data em que o negócio foi ganho. Cancelados e cortesias ficam fora. O número sobre a barra é a quantidade de ingressos e a linha mostra o total acumulado. O mês atual ainda está em andamento (parcial). A linha tracejada é a edição anterior no mesmo mês, quando 'Comparar' está ligado. ${VALOR_LIQUIDO_SYMPLA}`}
            />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {brl(total)} em {int(ingressos)} {ingressos === 1 ? "ingresso" : "ingressos"}{filtrado && " no período"}
            {melhor && melhor.total > 0 && ` · melhor mês: ${rotuloMes(melhor.mes, true)} (${brl(melhor.total)})`}
          </p>
        </div>
        <ChartLegend
          items={[
            { key: "sympla", label: "Sympla", color: COR_SYMPLA, shape: "square" as const },
            { key: "faturado", label: "Faturados internos", color: COR_FATURADO, shape: "square" as const },
            { key: "acumulado", label: "Acumulado", color: "hsl(var(--foreground))", shape: "line" as const },
            ...(temMeta ? [{ key: "meta", label: "Meta do mês", color: COR_META, shape: "dashed" as const }] : []),
            ...(mostrarAnterior ? [{ key: PREVIOUS_YEAR_KEY, label: rotulo, color: "hsl(var(--muted-foreground))", shape: "dashed" as const }] : []),
          ]}
          hidden={series.hidden}
          onToggle={series.toggle}
          onFocus={series.setFocused}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {meses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas de ingressos neste período.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dados} margin={{ left: 4, right: 8, top: 18 }}>
                <CartesianGrid vertical={false} className="stroke-border" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
                <YAxis yAxisId="mes" tick={{ fontSize: 11 }} tickFormatter={eixo} className="fill-muted-foreground" />
                <YAxis yAxisId="acc" orientation="right" tick={{ fontSize: 11 }} tickFormatter={eixo} className="fill-muted-foreground" />
                <Tooltip cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }} content={<Dica />} />
                <Bar yAxisId="mes" dataKey="sympla" stackId="fonte" fill={COR_SYMPLA} hide={series.hidden.has("sympla")} isAnimationActive={false} maxBarSize={44}>
                  {dados.map((d) => <Cell key={d.mes} fillOpacity={d.parcial ? 0.5 : 0.9} />)}
                </Bar>
                <Bar yAxisId="mes" dataKey="faturado" stackId="fonte" fill={COR_FATURADO} hide={series.hidden.has("faturado")} isAnimationActive={false} maxBarSize={44}>
                  {dados.map((d) => <Cell key={d.mes} fillOpacity={d.parcial ? 0.5 : 0.9} />)}
                </Bar>
                {/* Linha invisível só para escrever a quantidade de ingressos sobre cada barra. */}
                <Line
                  yAxisId="mes"
                  dataKey="total"
                  stroke="none"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  isAnimationActive={false}
                  label={({ x, y, index }: any) => {
                    const q = dados[index]?.ingressos ?? 0;
                    return q > 0 ? <text key={index} x={x} y={y - 6} textAnchor="middle" fontSize={11} className="fill-muted-foreground">{int(q)}</text> : <g key={index} />;
                  }}
                />
                {temMeta && <Line yAxisId="mes" dataKey="meta" name="Meta do mês" stroke={COR_META} strokeWidth={1.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} hide={series.hidden.has("meta")} strokeOpacity={series.opacity("meta", 0.9)} isAnimationActive={false} />}
                {mostrarAnterior && <Line yAxisId="mes" {...previousYearLineProps} name={rotulo} hide={series.hidden.has(PREVIOUS_YEAR_KEY)} strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, 0.55)} />}
                <Line yAxisId="acc" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 2.5 }} hide={series.hidden.has("acumulado")} strokeOpacity={series.opacity("acumulado", 0.8)} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            {comparar && !temAnterior && (
              <p className="text-[11px] text-muted-foreground">Sem vendas da edição anterior para comparar mês a mês.</p>
            )}
            <Collapsible open={tabelaAberta} onOpenChange={setTabelaAberta}>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-[10px] border bg-secondary/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <span>Tabela mês a mês</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", tabelaAberta && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs tabular-nums">
                    <thead>
                      <tr className="border-b text-right text-[11px] text-muted-foreground">
                        <th className="py-1.5 pr-3 text-left font-medium">Mês</th>
                        <th className="px-3 py-1.5 font-medium">Ingressos</th>
                        <th className="px-3 py-1.5 font-medium">Sympla</th>
                        <th className="px-3 py-1.5 font-medium">Faturados</th>
                        <th className="px-3 py-1.5 font-medium">Total</th>
                        <th className="px-3 py-1.5 font-medium">Acumulado</th>
                        {temMeta && <th className="py-1.5 pl-3 font-medium">Meta</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((m) => (
                        <tr key={m.mes} className="border-b border-border/60 text-right">
                          <td className={cn("py-1.5 pr-3 text-left", m.parcial && "text-muted-foreground")}>{rotuloMes(m.mes, true)}{m.parcial && " · parcial"}</td>
                          <td className="px-3 py-1.5">{int(m.ingressos)}</td>
                          <td className="px-3 py-1.5">{brl(m.sympla)}</td>
                          <td className="px-3 py-1.5">{brl(m.faturado)}</td>
                          <td className="px-3 py-1.5 font-semibold">{brl(m.total)}</td>
                          <td className="px-3 py-1.5">{brl(m.acumulado)}</td>
                          {temMeta && <td className="py-1.5 pl-3">{m.meta !== null ? brl(m.meta) : "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="text-right font-semibold">
                        <td className="py-1.5 pr-3 text-left">Total</td>
                        <td className="px-3 py-1.5">{int(ingressos)}</td>
                        <td className="px-3 py-1.5">{brl(totalSympla)}</td>
                        <td className="px-3 py-1.5">{brl(totalFaturado)}</td>
                        <td className="px-3 py-1.5">{brl(total)}</td>
                        <td className="px-3 py-1.5">{brl(total)}</td>
                        {temMeta && <td className="py-1.5 pl-3" />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Dica({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload as TicketMonth;
  return (
    <div className="min-w-[200px] rounded-[10px] border border-line-strong bg-card px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-semibold">{rotuloMes(m.mes, true)}{m.parcial && <span className="ml-1 font-normal text-muted-foreground">(parcial)</span>}</div>
      <div className="flex justify-between gap-4"><span>Total no mês</span><b className="tabular-nums">{brl(m.total)}</b></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Ingressos</span><span className="tabular-nums">{int(m.ingressos)}</span></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Sympla</span><span className="tabular-nums">{brl(m.sympla)}</span></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Faturados internos</span><span className="tabular-nums">{brl(m.faturado)}</span></div>
      <div className="mt-1 flex justify-between gap-4 border-t pt-1"><span>Acumulado</span><b className="tabular-nums">{brl(m.acumulado)}</b></div>
      {m.meta !== null && <div className="flex justify-between gap-4 text-muted-foreground"><span>Meta do mês</span><span className="tabular-nums">{brl(m.meta)}</span></div>}
      {m.anoAnterior !== null && <div className="flex justify-between gap-4 text-muted-foreground"><span>Ano anterior no mês</span><span className="tabular-nums">{brl(m.anoAnterior)}</span></div>}
    </div>
  );
}
