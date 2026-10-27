import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ConversionFunnelChartProps {
  ga4Events: any[];
}

const FUNNEL_STEPS = [
  { key: "page_view", label: "Page View" },
  { key: "view_item", label: "View Item" },
  { key: "add_to_cart", label: "Add to Cart" },
  { key: "begin_checkout", label: "Begin Checkout" },
  { key: "purchase", label: "Purchase" },
];

export function ConversionFunnelChart({ ga4Events }: ConversionFunnelChartProps) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ga4Events) {
      map.set(row.event_name, (map.get(row.event_name) || 0) + (row.event_count || 0));
    }
    return FUNNEL_STEPS.map((step) => ({
      ...step,
      count: map.get(step.key) || 0,
    }));
  }, [ga4Events]);

  const maxCount = Math.max(...totals.map((t) => t.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">Funil de Conversão do Site <InfoTip title="Funil de Conversão do Site" /></CardTitle>
      </CardHeader>
      <CardContent>
        {totals.every((t) => t.count === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum dado de eventos no período
          </p>
        ) : (
          <div className="flex items-end gap-2 sm:gap-4">
            {totals.map((step, i) => {
              const heightPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
              const prevCount = i > 0 ? totals[i - 1].count : null;
              const conversionRate = prevCount && prevCount > 0 ? (step.count / prevCount) * 100 : null;
              const dropoffRate = conversionRate !== null ? 100 - conversionRate : null;

              return (
                <div key={step.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {/* Conversion rate from previous step */}
                  {conversionRate !== null && (
                    <div className="text-xs font-medium text-accent-text mb-1">
                      {conversionRate.toFixed(1)}%
                    </div>
                  )}
                  {i === 0 && <div className="text-xs font-medium text-transparent mb-1">&nbsp;</div>}

                  {/* Count */}
                  <div className="text-sm font-bold truncate w-full text-center">
                    {step.count.toLocaleString("pt-BR")}
                  </div>

                  {/* Bar */}
                  <div className="w-full flex justify-center">
                    <div className="w-full max-w-16 relative" style={{ height: "160px" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t bg-primary/80 transition-all"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Label */}
                  <div className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight mt-1">
                    {step.label}
                  </div>

                  {/* Dropoff */}
                  {dropoffRate !== null && dropoffRate > 0 && (
                    <div className="text-[10px] text-destructive">
                      -{dropoffRate.toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
