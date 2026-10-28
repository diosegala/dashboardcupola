import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { addYears, format, parseISO } from "date-fns";
import { ChartLegend } from "./ChartLegend";
import { PREVIOUS_YEAR_KEY, previousYearLineProps, useSeriesVisibility } from "./chartSeries";
import { useCompare } from "@/hooks/useCompare";
import { ptBR } from "date-fns/locale";

interface ClicksByDayChartProps {
  adMetrics: any[];
  // Métricas do evento anterior (base própria), um ano antes do período atual.
  previousAdMetrics?: any[];
}

export function ClicksByDayChart({ adMetrics, previousAdMetrics = [] }: ClicksByDayChartProps) {
  const series = useSeriesVisibility();
  const previousByDay = useMemo(() => {
    const map = new Map<string, number>();
    previousAdMetrics
      .filter((a) => a.source === "meta")
      .forEach((a) => {
        const day = format(addYears(parseISO(a.date), 1), "yyyy-MM-dd");
        map.set(day, (map.get(day) || 0) + (a.link_clicks || a.clicks || 0));
      });
    return map;
  }, [previousAdMetrics]);
  // Linha do evento anterior só com a chave "Comparar" ligada.
  const { ativo: comparar, rotulo } = useCompare();
  const hasPrevious = comparar && previousByDay.size > 0;

  const data = useMemo(() => {
    const map = new Map<string, number>();
    adMetrics
      .filter((a) => a.source === "meta")
      .forEach((a) => {
        const day = a.date;
        map.set(day, (map.get(day) || 0) + (a.link_clicks || a.clicks || 0));
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, clicks]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        "Meta Ads": clicks,
        ...(hasPrevious ? { [PREVIOUS_YEAR_KEY]: previousByDay.get(date) ?? 0 } : {}),
      }));
  }, [adMetrics, previousByDay, hasPrevious]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">Cliques por Dia (Meta Ads) <InfoTip title="Cliques por Dia (Meta Ads)" /></CardTitle>
        {hasPrevious && (
          <ChartLegend
            items={[
              { key: "Meta Ads", label: "Meta Ads", color: "hsl(var(--chart-1))", shape: "line" },
              { key: PREVIOUS_YEAR_KEY, label: rotulo, color: "hsl(var(--muted-foreground))", shape: "dashed" },
            ]}
            hidden={series.hidden}
            onToggle={series.toggle}
            onFocus={series.setFocused}
          />
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              {hasPrevious && (

                <Line

                  {...previousYearLineProps}
                  name={rotulo}

                  hide={series.hidden.has(PREVIOUS_YEAR_KEY)}

                  strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, previousYearLineProps.strokeOpacity)}

                />

              )}
              <Line type="monotone" dataKey="Meta Ads" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} hide={series.hidden.has("Meta Ads")} strokeOpacity={series.opacity("Meta Ads")} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de anúncios no período</p>
        )}
      </CardContent>
    </Card>
  );
}
