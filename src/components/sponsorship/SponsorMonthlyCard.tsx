import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { ChartLegend } from "@/components/dashboard/charts/ChartLegend";
import { PREVIOUS_YEAR_KEY, previousYearLineProps, useSeriesVisibility } from "@/components/dashboard/charts/chartSeries";
import { useCompare } from "@/hooks/useCompare";
import { rotuloMes, type SponsorMonth } from "@/lib/monthlyRevenue";
import { cn } from "@/lib/utils";

const PALETA = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-3))", "hsl(var(--chart-5))"];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const eixo = (n: number) => (n >= 1000 ? `R$ ${Math.round(n / 1000).toLocaleString("pt-BR")} mil` : `R$ ${Math.round(n)}`);

interface Props {
  className?: string;
  meses: SponsorMonth[];
  temParcelas: boolean;
  exemplo?: boolean;
}

// Faturamento de patrocínio mês a mês: barras por cota (mês do fechamento), acumulado e ano anterior.
export function SponsorMonthlyCard({ className, meses, temParcelas, exemplo }: Props) {
  const { ativo: comparar, rotulo } = useCompare();
  const series = useSeriesVisibility();
  const temAnterior = meses.some((m) => m.anoAnterior !== null);
  const mostrarAnterior = comparar && temAnterior;
  // Cotas que aparecem em algum mês, na ordem de maior valor.
  const cotas = new Map<string, { nome: string; valor: number }>();
  for (const m of meses) for (const [k, c] of Object.entries(m.porCota)) {
    const x = cotas.get(k) ?? { nome: c.nome, valor: 0 };
    x.valor += c.valor;
    cotas.set(k, x);
  }
  const ordem = [...cotas.entries()].sort((a, b) => b[1].valor - a[1].valor);
  const cor = (i: number) => PALETA[i % PALETA.length];
  const dados = meses.map((m) => ({
    ...m,
    nome: `${rotuloMes(m.mes, true)}${m.parcial ? " · parcial" : ""}`,
    ...Object.fromEntries(ordem.map(([k]) => [`c_${k}`, m.porCota[k]?.valor ?? 0])),
    [PREVIOUS_YEAR_KEY]: m.anoAnterior,
  }));
  const total = meses.reduce((s, m) => s + m.valor, 0);
  const totalCotas = meses.reduce((s, m) => s + m.cotas, 0);
  const semValor = meses.reduce((s, m) => s + m.semValor, 0);
  const melhor = meses.reduce<SponsorMonth | null>((b, m) => (m.valor > (b?.valor ?? 0) ? m : b), null);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            Faturamento de patrocínios por mês
            <InfoTip
              title="Faturamento de patrocínios por mês"
              text="Quanto de patrocínio foi fechado em cada mês, pela data em que o negócio foi ganho no Pipedrive. Negócios em negociação e perdidos ficam fora. As cores separam os tipos de cota e a linha mostra o total acumulado. O mês atual ainda está em andamento (parcial). A linha tracejada é a edição anterior no mesmo mês, quando 'Comparar' está ligado."
            />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {brl(total)} em {totalCotas} {totalCotas === 1 ? "cota" : "cotas"}
            {melhor && melhor.valor > 0 && ` · melhor mês: ${rotuloMes(melhor.mes, true)} (${brl(melhor.valor)})`}
            {semValor > 0 && <span className="italic"> · {semValor} {semValor === 1 ? "venda com" : "vendas com"} valor não informado</span>}
          </p>
        </div>
        <ChartLegend
          items={[
            ...ordem.map(([k, c], i) => ({ key: `c_${k}`, label: c.nome, color: cor(i), shape: "square" as const })),
            { key: "acumulado", label: "Acumulado", color: "hsl(var(--foreground))", shape: "line" as const },
            ...(mostrarAnterior ? [{ key: PREVIOUS_YEAR_KEY, label: rotulo, color: "hsl(var(--muted-foreground))", shape: "dashed" as const }] : []),
          ]}
          hidden={series.hidden}
          onToggle={series.toggle}
          onFocus={series.setFocused}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dados} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} className="stroke-border" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
            <YAxis yAxisId="mes" tick={{ fontSize: 11 }} tickFormatter={eixo} className="fill-muted-foreground" />
            <YAxis yAxisId="acc" orientation="right" tick={{ fontSize: 11 }} tickFormatter={eixo} className="fill-muted-foreground" />
            <Tooltip cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }} content={<Dica />} />
            {ordem.map(([k], i) => (
              <Bar key={k} yAxisId="mes" dataKey={`c_${k}`} stackId="cotas" fill={cor(i)} hide={series.hidden.has(`c_${k}`)} isAnimationActive={false} maxBarSize={44}>
                {dados.map((d) => <Cell key={d.mes} fillOpacity={d.parcial ? 0.5 : 0.9} />)}
              </Bar>
            ))}
            {mostrarAnterior && <Line yAxisId="mes" {...previousYearLineProps} name={rotulo} hide={series.hidden.has(PREVIOUS_YEAR_KEY)} strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, 0.55)} />}
            <Line yAxisId="acc" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 2.5 }} hide={series.hidden.has("acumulado")} strokeOpacity={series.opacity("acumulado", 0.8)} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {comparar && !temAnterior && !exemplo && (
          <p className="text-[11px] text-muted-foreground">Sem vendas da edição anterior para comparar mês a mês.</p>
        )}
        {temParcelas ? (
          <Previsto meses={meses} />
        ) : (
          <p className="rounded-xl border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
            Sem datas de pagamento no Pipedrive: a receita prevista por mês de pagamento aparece aqui quando os negócios tiverem parcelas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Previsto({ meses }: { meses: SponsorMonth[] }) {
  const lista = meses.filter((m) => (m.previsto ?? 0) > 0 || !m.futuro);
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-muted-foreground">Previsto por mês de pagamento (parcelas no Pipedrive)</div>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((m) => (
          <div key={m.mes} className={cn("rounded-xl bg-secondary/60 px-2.5 py-1.5 text-[11px]", m.parcial && "ring-1 ring-line-strong")}>
            <span className="text-muted-foreground">{rotuloMes(m.mes, true)}</span>{" "}
            <b className="font-semibold tabular-nums">{brl(m.previsto ?? 0)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dica({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload as SponsorMonth & { nome: string };
  const cotas = Object.values(m.porCota).filter((c) => c.quantidade > 0 || c.valor > 0);
  return (
    <div className="min-w-[200px] rounded-[10px] border border-line-strong bg-card px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-semibold">{rotuloMes(m.mes, true)}{m.parcial && <span className="ml-1 font-normal text-muted-foreground">(parcial)</span>}</div>
      <div className="flex justify-between gap-4"><span>Fechado no mês</span><b className="tabular-nums">{brl(m.valor)}</b></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Cotas fechadas</span><span className="tabular-nums">{m.cotas}</span></div>
      {cotas.map((c) => (
        <div key={c.nome} className="flex justify-between gap-4 pl-2 text-muted-foreground"><span>{c.nome} · {c.quantidade}</span><span className="tabular-nums">{c.valor > 0 ? brl(c.valor) : <i>valor não informado</i>}</span></div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t pt-1"><span>Acumulado</span><b className="tabular-nums">{brl(m.acumulado)}</b></div>
      {m.anoAnterior !== null && <div className="flex justify-between gap-4 text-muted-foreground"><span>Ano anterior no mês</span><span className="tabular-nums">{brl(m.anoAnterior)}</span></div>}
      {m.previsto !== null && <div className="flex justify-between gap-4 text-muted-foreground"><span>Previsto (pagamento)</span><span className="tabular-nums">{brl(m.previsto)}</span></div>}
    </div>
  );
}
