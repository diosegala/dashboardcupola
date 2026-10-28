import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { addYears, format, parseISO } from "date-fns";
import { ChartLegend } from "./ChartLegend";
import { PREVIOUS_YEAR_KEY, PREVIOUS_YEAR_LABEL, previousYearLineProps, useSeriesVisibility } from "./chartSeries";
import { ptBR } from "date-fns/locale";

interface SessionsByDayChartProps {
  siteAnalytics: any[];
  // Dados do site do evento anterior (base própria), um ano antes do período atual.
  previousSiteAnalytics?: any[];
}

export function SessionsByDayChart({ siteAnalytics, previousSiteAnalytics = [] }: SessionsByDayChartProps) {
  const series = useSeriesVisibility();
  const previousByDay = useMemo(
    () => new Map(previousSiteAnalytics.map((s) => [format(addYears(parseISO(s.date), 1), "yyyy-MM-dd"), s.sessions || 0])),
    [previousSiteAnalytics],
  );
  const hasPrevious = previousByDay.size > 0;

  const data = useMemo(() => {
    return siteAnalytics.map((s) => ({
      date: s.date,
      label: format(parseISO(s.date), "dd/MM", { locale: ptBR }),
      sessões: s.sessions || 0,
      ...(hasPrevious ? { [PREVIOUS_YEAR_KEY]: previousByDay.get(s.date) ?? 0 } : {}),
    }));
  }, [siteAnalytics, previousByDay, hasPrevious]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">Sessões do Site por Dia <InfoTip title="Sessões do Site por Dia" /></CardTitle>
        {hasPrevious && (
          <ChartLegend
            items={[
              { key: "sessões", label: "Sessões", color: "hsl(var(--chart-2))", shape: "line" },
              { key: PREVIOUS_YEAR_KEY, label: PREVIOUS_YEAR_LABEL, color: "hsl(var(--muted-foreground))", shape: "dashed" },
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

                  hide={series.hidden.has(PREVIOUS_YEAR_KEY)}

                  strokeOpacity={series.opacity(PREVIOUS_YEAR_KEY, previousYearLineProps.strokeOpacity)}

                />

              )}
              <Line type="monotone" dataKey="sessões" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} hide={series.hidden.has("sessões")} strokeOpacity={series.opacity("sessões")} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado de analytics no período</p>
        )}
      </CardContent>
    </Card>
  );
}
