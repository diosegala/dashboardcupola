import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  goal?: number | null;
  suffix?: string;
  prefix?: string;
  description?: string;
  onEditGoal?: () => void;
}

function getStatusColor(pct: number) {
  if (pct >= 100) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-destructive";
}

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-success";
  if (pct >= 70) return "bg-warning";
  return "bg-destructive";
}

export function MetricCard({ title, value, icon: Icon, goal, suffix, prefix, description, onEditGoal }: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const pct = goal && goal > 0 ? Math.round((numericValue / goal) * 100) : null;

  return (
    <Card className="hover:-translate-y-[3px] hover:border-line-strong">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[13px] font-semibold text-foreground/75">{title}</CardTitle>
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
