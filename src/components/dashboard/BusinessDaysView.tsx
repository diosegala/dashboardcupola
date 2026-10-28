import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { businessDaysBetween, lastBusinessDays, isBusinessDay } from "@/lib/businessDays";
import { CURRENT_PACE_DAYS } from "@/lib/eventConfig";
import { cn } from "@/lib/utils";

type Modo = "15" | "mes" | "tudo";

interface BusinessDaysViewProps {
  paidByDay: Record<string, number>;
  firstSaleDate: Date;
  // Sem meta de pagantes: barras numa cor só e sem a linha do necessário.
  requiredPace: number | null;
}

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const COR = { ok: "hsl(var(--data-blue))", abaixo: "hsl(var(--warn))", muted: "hsl(var(--muted-foreground))" };

// Vendas em cada dia útil até hoje (nunca dias futuros): últimos 15, um mês por vez ou tudo desde a primeira venda.
export function BusinessDaysView({ paidByDay, firstSaleDate, requiredPace }: BusinessDaysViewProps) {
  const hoje = startOfDay(new Date());
  const [modo, setModo] = useState<Modo>("15");
  const [mes, setMes] = useState(startOfMonth(hoje));
  const primeiroMes = startOfMonth(firstSaleDate);

  const dias = useMemo(() => {
    if (modo === "15") {
      // Os 15 dias úteis mais recentes, incluindo hoje quando é dia útil.
      return isBusinessDay(hoje) ? [...lastBusinessDays(hoje, 14), hoje] : lastBusinessDays(hoje, 15);
    }
    if (modo === "mes") {
      const fim = isBefore(endOfMonth(mes), hoje) ? endOfMonth(mes) : hoje;
      return businessDaysBetween(mes, fim);
    }
    return businessDaysBetween(isAfter(firstSaleDate, hoje) ? hoje : firstSaleDate, hoje);
  }, [modo, mes, firstSaleDate, hoje.getTime()]);

  const data = dias.map((d) => {
    const vendas = paidByDay[format(d, "yyyy-MM-dd")] || 0;
    return { date: format(d, "yyyy-MM-dd"), label: format(d, "dd/MM"), vendas, onPace: requiredPace === null || vendas >= requiredPace };
  });
  const total = data.reduce((s, d) => s + d.vendas, 0);
  const diasNoRitmo = data.filter((d) => d.onPace).length;

  const botao = (m: Modo, rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150",
        modo === m ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {rotulo}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-full border bg-secondary p-1">
          {botao("15", "Últimos 15")}
          {botao("mes", "Por mês")}
          {botao("tudo", "Tudo")}
        </div>
        {modo === "mes" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Mês anterior" disabled={!isAfter(mes, primeiroMes)} onClick={() => setMes((m) => addMonths(m, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-semibold capitalize">{format(mes, "MMMM yyyy", { locale: ptBR })}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Próximo mês" disabled={!isBefore(mes, startOfMonth(hoje))} onClick={() => setMes((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {requiredPace !== null && <div className="flex flex-wrap gap-3.5 text-xs text-foreground/75">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COR.ok }} /> No ritmo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COR.abaixo }} /> Abaixo
          </span>
        </div>}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {int(total)} vendas em {int(data.length)} dias úteis{requiredPace !== null && <> · {int(diasNoRitmo)} {diasNoRitmo === 1 ? "dia" : "dias"} no ritmo</>}
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: -12, right: 8, top: 16 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} className="fill-muted-foreground" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
          <Tooltip
            cursor={{ fill: "hsl(var(--secondary))" }}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => [int(v), "Pagantes"]}
          />
          {requiredPace !== null && <ReferenceLine
            y={requiredPace}
            ifOverflow="extendDomain"
            stroke={COR.muted}
            strokeDasharray="4 4"
            label={{ value: `Necessário ${int(Math.ceil(requiredPace))}`, position: "insideTopRight", fontSize: 11, fill: COR.muted }}
          />}
          <Bar dataKey="vendas" radius={[6, 6, 0, 0]} animationDuration={900}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.onPace ? COR.ok : COR.abaixo} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        Ritmo atual considera a média dos últimos {CURRENT_PACE_DAYS} dias úteis. Feriados nacionais e fins de semana ficam de fora.
      </p>
    </div>
  );
}
