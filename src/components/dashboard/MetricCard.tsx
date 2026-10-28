import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { GoalMeter } from "@/components/GoalMeter";
import { CompareLine } from "@/components/CompareLine";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  // Meta do período (linha da tabela goals). Sem meta, o card mostra só o número e a descrição.
  goal?: { target_value: number | string; period_start: string; period_end: string } | null;
  suffix?: string;
  prefix?: string;
  description?: string;
  // Mesmo indicador no mesmo período do evento anterior (aparece com a chave "Comparar" ligada).
  anterior?: number | null;
}

export function MetricCard({ title, value, icon: Icon, goal: goalRow, suffix, prefix, description, anterior }: MetricCardProps) {
  // Texto no formato brasileiro ("12.345,67") ou com ponto decimal ("1.23", "12.5%").
  const bruto = String(value).replace(/[^0-9,.-]/g, "");
  const numericValue = typeof value === "number" ? value : parseFloat(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto) || 0;
  const target = goalRow ? Number(goalRow.target_value) : 0;
  const isRate = typeof value === "string" && value.includes("%");
  const unit = isRate ? "pct" : prefix?.includes("R$") ? "brl" : "num";

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
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        <CompareLine
          className="mt-1.5"
          anterior={anterior}
          atual={numericValue}
          quando="no mesmo período"
          formato={(n) =>
            unit === "pct"
              ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
              : unit === "brl"
                ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                : Math.round(n).toLocaleString("pt-BR")
          }
        />
        {goalRow && target > 0 && (
          <GoalMeter className="mt-3" actual={numericValue} target={target} unit={unit} periodStart={goalRow.period_start} periodEnd={goalRow.period_end} />
        )}
      </CardContent>
    </Card>
  );
}
