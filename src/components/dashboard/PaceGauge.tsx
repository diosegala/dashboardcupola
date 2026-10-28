import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { CountUp } from "@/components/CountUp";
import { cn } from "@/lib/utils";
import { CompareLine } from "@/components/CompareLine";

interface PaceGaugeProps {
  currentPace: number;
  // Sem meta de pagantes não existe ritmo necessário: o velocímetro mostra só o ritmo atual.
  requiredPace: number | null;
  remainingDays: number;
  chip: { label: string; variant: ChipVariant } | null;
  // Ritmo do evento anterior na mesma época (últimos dias úteis, um ano antes).
  ritmoAnterior?: number | null;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Meio círculo de 180° (da esquerda para a direita), raio R, centro (CX, CY).
const R = 80;
const CX = 100;
const CY = 96;
const point = (frac: number, r = R) => {
  const a = Math.PI * (1 - frac);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arcLength = Math.PI * R;

// Velocímetro do ritmo: o arco enche até o ritmo atual e um marcador mostra o ritmo necessário.
export function PaceGauge({ currentPace, requiredPace, remainingDays, chip, ritmoAnterior, className }: PaceGaugeProps) {
  // Escala vai até o dobro do necessário (ou até o atual, se passar disso).
  const temMeta = requiredPace !== null;
  const max = temMeta ? Math.max((requiredPace as number) * 2, currentPace * 1.1, 1) : Math.max(currentPace * 1.4, 1);
  const atualFrac = Math.min(currentPace / max, 1);
  const necessarioFrac = temMeta ? Math.min((requiredPace as number) / max, 1) : 0;
  const noRitmo = temMeta && currentPace >= (requiredPace as number);
  const corArco = !temMeta ? "hsl(var(--data-blue))" : noRitmo ? "hsl(var(--ok))" : "hsl(var(--warn))";

  // Preenche ao aparecer (1,2 s), como o anel da meta.
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFrac(atualFrac));
    return () => cancelAnimationFrame(id);
  }, [atualFrac]);

  const marcaIn = point(necessarioFrac, R - 14);
  const marcaOut = point(necessarioFrac, R + 14);
  const rotulo = point(necessarioFrac, R + 26);

  return (
    <Card className={cn("flex flex-col gap-2 p-5 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        Ritmo de vendas <InfoTip title="Ritmo de vendas" />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <svg viewBox="0 -28 200 144" className="h-[144px] w-[200px] shrink-0" role="img" aria-label={`Ritmo atual ${fmt(currentPace)} por dia útil${temMeta ? `; necessário ${fmt(requiredPace as number)}` : ""}`}>
          <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="hsl(var(--secondary))" strokeWidth="16" strokeLinecap="round" />
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={corArco}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-[1200ms] ease-cupola motion-reduce:transition-none"
          />
          {temMeta && (
            <>
              <line x1={marcaIn.x} y1={marcaIn.y} x2={marcaOut.x} y2={marcaOut.y} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
              <text x={rotulo.x} y={rotulo.y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
                {fmt(Math.ceil(requiredPace as number))}
              </text>
            </>
          )}
          <text x={CX} y={CY - 22} textAnchor="middle" className="fill-foreground text-[30px] font-semibold tracking-[-0.035em]">
            {fmt(currentPace)}
          </text>
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            por dia útil
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-1.5 text-sm">
          {temMeta ? (
            <span className="text-muted-foreground">
              Precisa de <b className="font-semibold text-foreground"><CountUp value={Math.ceil(requiredPace as number)} format={(n) => fmt(Math.round(n))} /></b> por dia útil
            </span>
          ) : (
            <span className="text-muted-foreground">Média de vendas pagantes nos últimos dias úteis</span>
          )}
          <span className="text-xs text-muted-foreground">{remainingDays.toLocaleString("pt-BR")} dias úteis até o evento</span>
          <CompareLine anterior={ritmoAnterior} atual={currentPace} formato={(n) => `${fmt(n)}/dia`} quando="nesta época" />
          {chip && (
            <span>
              <Chip variant={chip.variant}>{chip.label}</Chip>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
