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

export function MetricCard({ title, value, icon: Icon, goal, suffix, prefix, description }: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const pct = goal && goal > 0 ? Math.round((numericValue / goal) * 100) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {prefix}{typeof value === "number" ? value.toLocaleString("pt-BR") : value}{suffix}
        </div>
        {pct !== null && goal ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Meta: {prefix}{goal.toLocaleString("pt-BR")}{suffix}
              </span>
              <span className={cn("font-semibold", getStatusColor(pct))}>
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getProgressColor(pct))}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        ) : description ? (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Sem meta configurada</p>
        )}
      </CardContent>
    </Card>
  );
}
