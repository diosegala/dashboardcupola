import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { goalPace } from "@/lib/goalPace";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  // Meta do período (linha da tabela goals): traz valor-alvo e datas para calcular a situação.
  goal?: { target_value: number | string; period_start: string; period_end: string } | null;
  suffix?: string;
  prefix?: string;
  description?: string;
  onEditGoal?: () => void;
}

function getStatusColor(pct: number) {
  if (pct >= 100) return "text-ok";
  if (pct >= 70) return "text-warn";
  return "text-bad";
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-primary";
  if (pct >= 70) return "bg-warn";
  return "bg-bad";
}

export function MetricCard({ title, value, icon: Icon, goal: goalRow, suffix, prefix, description, onEditGoal }: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const goal = goalRow ? Number(goalRow.target_value) : null;
  const pct = goal && goal > 0 ? Math.round((numericValue / goal) * 100) : null;
  // Taxas (%) não se acumulam no tempo: comparam direto com a meta. Contagens comparam com o esperado até hoje.
  const isRate = typeof value === "string" && value.includes("%");
  const pace = !goalRow || !goal
    ? null
    : isRate
      ? numericValue >= goal
        ? { label: "Na meta", variant: "ok" as const }
        : { label: "Abaixo da meta", variant: "warn" as const }
      : goalPace(numericValue, goal, goalRow.period_start, goalRow.period_end);

  return (
    <Card className="hover:-translate-y-[3px] hover:border-line-strong">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
          {title}
          <InfoTip title={title} />
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent>
        <div className="text-[clamp(28px,2.8vw,36px)] font-semibold leading-[1.1] tracking-[-0.035em]">
          {prefix}{typeof value === "number" ? value.toLocaleString("pt-BR") : value}{suffix}
        </div>
        {pct !== null && goal ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                Meta: {prefix}{goal.toLocaleString("pt-BR")}{suffix}
                {onEditGoal && (
                  <button onClick={onEditGoal} className="inline-flex items-center justify-center rounded-sm hover:bg-muted p-0.5 transition-colors" title="Editar meta">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
              <span className={cn("font-semibold", getStatusColor(pct))}>
                {pct}%
              </span>
            </div>
            {pace && (
              <div className="pt-1">
                <Chip variant={pace.variant}>{pace.label}</Chip>
              </div>
            )}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all", getProgressColor(pct))}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        ) : description ? (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Sem meta configurada
            {onEditGoal && (
              <button onClick={onEditGoal} className="inline-flex items-center justify-center rounded-sm hover:bg-muted p-0.5 transition-colors" title="Criar meta">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
