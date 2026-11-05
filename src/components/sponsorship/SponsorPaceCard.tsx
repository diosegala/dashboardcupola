import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { useCompare } from "@/hooks/useCompare";
import { ChartLegend } from "@/components/dashboard/charts/ChartLegend";
import { PREVIOUS_YEAR_KEY, previousYearLineProps, useSeriesVisibility } from "@/components/dashboard/charts/chartSeries";
import type { WeekPoint } from "@/lib/sponsorshipMetrics";
import { CardTabs } from "./CardTabs";
import { brl } from "./SponsorRevenueCard";

export const PACE_INFO = {
  card: "A edição anterior entra no mesmo número de dias antes do evento. Ritmo necessário = quanto falta ÷ semanas até a abertura do evento.",
  receita: "Receita de patrocínio acumulada semana a semana, com a meta ampliada tracejada e o ritmo necessário até a abertura.",
  cotas: "Cotas vendidas acumuladas semana a semana, contra a soma das metas de cada cota.",
};

const COLORS = {
  blue: "hsl(var(--data-blue))",
  amber: "hsl(var(--warn))",
  muted: "hsl(var(--muted-foreground))",
};

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const eixo = (n: number) => (n >= 1_000_000 ? `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : n >= 1000 ? `R$ ${Math.round(n / 1000)} mil` : `R$ ${Math.round(n)}`);

interface Props {
  semanas: WeekPoint[];
  meta: number | null;
  metaCotas: number | null;
  ritmoSemanal: number | null;
  semanasRestantes: number;
  className?: string;
}

export function SponsorPaceCard({ semanas, meta, metaCotas, ritmoSemanal, semanasRestantes, className }: Props) {
  const [aba, setAba] = useState<"receita" | "cotas">("receita");
  const series = useSeriesVisibility();
  const { ativo: comparar, rotulo } = useCompare();
  const receita = aba === "receita";
  const mostrarAnterior = receita && comparar && semanas.some((w) => w.anterior != null);
  const alvo = receita ? meta : metaCotas;
  const titulo = alvo ? "Receita acumulada x meta" : "Receita acumulada";
  const fmt = receita ? brl : int;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            {titulo} <InfoTip title={titulo} text={PACE_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {receita && ritmoSemanal != null ? (
              <>
                Ritmo necessário: <b className="font-semibold text-foreground">{brl(ritmoSemanal)}</b> por semana nas {int(semanasRestantes)} semanas até a abertura
              </>
            ) : (
              "Semanas desde o início das vendas desta edição"
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CardTabs
            value={aba}
            onChange={(v) => setAba(v as typeof aba)}
            tabs={[
              { value: "receita", label: "Receita", info: PACE_INFO.receita },
              { value: "cotas", label: "Cotas", info: PACE_INFO.cotas },
            ]}
          />
          <ChartLegend
            items={[
              { key: "valor", label: receita ? "Receita" : "Cotas", color: COLORS.blue, shape: "line" },
              ...(alvo ? [{ key: "meta", label: receita ? "Meta ampliada" : "Meta de cotas", color: COLORS.amber, shape: "dashed" as const }] : []),
              ...(receita && ritmoSemanal != null ? [{ key: "ritmo", label: "Ritmo necessário", color: COLORS.amber, shape: "dotted" as const }] : []),
              ...(mostrarAnterior ? [{ key: PREVIOUS_YEAR_KEY, label: rotulo, color: COLORS.muted, shape: "dotted" as const }] : []),
            ]}
            hidden={series.hidden}
            onToggle={series.toggle}
            onFocus={series.setFocused}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={semanas} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} className="fill-muted-foreground" />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (receita ? eixo(v) : int(v))}
              allowDecimals={false}
              width={receita ? 84 : 40}
              domain={[0, (max: number) => Math.max(max, alvo ?? 0)]}
              className="fill-muted-foreground"
            />
            <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [fmt(v), n]} labelFormatter={(l) => `Semana de ${l}`} />
            {alvo && !series.hidden.has("meta") && (
              <ReferenceLine y={alvo} stroke={COLORS.amber} strokeDasharray="6 4" strokeWidth={1.5} strokeOpacity={series.opacity("meta", 0.9)} />
            )}
            {mostrarAnterior && <Line {...previousYearLineProps} dataKey="anterior" name={rotulo} hide={series.hidden.has(PREVIOUS_YEAR_KEY)} strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, 0.7)} />}
            {receita && ritmoSemanal != null && (
              <Line
                dataKey="ritmo"
                name="Ritmo necessário"
                stroke={COLORS.amber}
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                activeDot={false}
                hide={series.hidden.has("ritmo")}
                strokeOpacity={series.opacity("ritmo", 0.85)}
                animationDuration={1000}
              />
            )}
            <Line
              dataKey={receita ? "receita" : "cotas"}
              name={receita ? "Receita" : "Cotas"}
              type="monotone"
              stroke={COLORS.blue}
              strokeWidth={2.25}
              dot={false}
              connectNulls={false}
              hide={series.hidden.has("valor")}
              strokeOpacity={series.opacity("valor")}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
