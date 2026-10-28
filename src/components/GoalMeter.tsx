import { useEffect, useState } from "react";
import { Chip } from "@/components/Chip";
import { goalPace } from "@/lib/goalPace";
import { formatGoalValue, type GoalUnit } from "@/lib/goalMetrics";
import { cn } from "@/lib/utils";

interface GoalMeterProps {
  actual: number;
  target: number;
  unit?: GoalUnit;
  // Datas da meta: com elas aparece a marquinha de onde deveria estar hoje e a situação.
  periodStart?: string;
  periodEnd?: string;
  className?: string;
}

// Sinalização de meta, igual em todo o painel: linha fina que enche até o realizado, marquinha do esperado para hoje
// e a situação em texto. Só aparece quando existe meta.
export function GoalMeter({ actual, target, unit = "num", periodStart, periodEnd, className }: GoalMeterProps) {
  const [cheio, setCheio] = useState(0);
  const frac = target > 0 ? actual / target : 0;
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(Math.min(frac, 1)));
    return () => cancelAnimationFrame(id);
  }, [frac]);

  // Taxas (%) não se acumulam no tempo: só comparam com a meta.
  const pace =
    unit === "pct"
      ? actual >= target
        ? { label: "Na meta", variant: "ok" as const, expected: target }
        : { label: "Abaixo da meta", variant: "warn" as const, expected: target }
      : periodStart && periodEnd
        ? goalPace(actual, target, periodStart, periodEnd)
        : null;
  const esperado = pace && unit !== "pct" && target > 0 ? Math.min(pace.expected / target, 1) : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          Meta <b className="font-semibold text-foreground/85">{formatGoalValue(target, unit)}</b>
        </span>
        <span className="font-semibold tabular-nums text-foreground/85">{Math.round(frac * 100).toLocaleString("pt-BR")}%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[1100ms] ease-cupola motion-reduce:transition-none"
          style={{ width: `${cheio * 100}%` }}
        />
        {esperado !== null && esperado > 0 && esperado < 1 && (
          <span
            className="absolute -top-[3px] h-[12px] w-[2px] rounded-full bg-foreground/45"
            style={{ left: `calc(${esperado * 100}% - 1px)` }}
            title="Onde deveria estar hoje"
          />
        )}
      </div>
      {pace && <Chip variant={pace.variant} className="px-2 py-0.5 text-[11px]">{pace.label}</Chip>}
    </div>
  );
}
