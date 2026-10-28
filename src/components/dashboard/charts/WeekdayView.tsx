import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { getDay } from "date-fns";
import { splitTickets } from "@/hooks/useCommercialMetrics";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom

interface WeekdayViewProps {
  tickets: any[];
}

// Ingressos pagantes por dia da semana (contagem e % do total).
function weekdayCounts(tickets: any[]) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  splitTickets(tickets).paying.forEach((t) => {
    if (!t.sold_at) return;
    counts[getDay(new Date(t.sold_at))] += t.quantity || 0;
  });
  const total = counts.reduce((s, v) => s + v, 0);
  return { counts, total };
}

const pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

// Visão "dia da semana" do card Vendas por dia (sem o card em volta).
export function WeekdayView({ tickets }: WeekdayViewProps) {
  const atual = useMemo(() => weekdayCounts(tickets), [tickets]);

  const data = useMemo(
    () =>
      MONDAY_FIRST.map((d) => ({
        day: WEEKDAY_LABELS[d],
        vendas: atual.counts[d],
      })),
    [atual],
  );

  const melhor = atual.total > 0 ? atual.counts.indexOf(Math.max(...atual.counts)) : -1;
  const semVenda = MONDAY_FIRST.filter((d) => atual.counts[d] === 0).map((d) => WEEKDAY_NAMES[d]);
  const maisFraco =
    semVenda.length === 0 && atual.total > 0
      ? WEEKDAY_NAMES[MONDAY_FIRST.reduce((min, d) => (atual.counts[d] < atual.counts[min] ? d : min), MONDAY_FIRST[0])]
      : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        {melhor >= 0 ? (
          <p className="text-xs text-muted-foreground">
            Melhor dia: <b className="font-semibold text-foreground">{WEEKDAY_NAMES[melhor]}</b> ({fmtPct(pct(atual.counts[melhor], atual.total))} das vendas)
            {semVenda.length > 0 && <> · Sem venda: {semVenda.join(", ")}</>}
            {maisFraco && <> · Mais fraco: {maisFraco}</>}
          </p>
        ) : (
          <span />
        )}
      </div>
        {atual.total > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 20 }}>
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip
                cursor={{ fill: "hsl(var(--secondary))" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString("pt-BR")} vendas (${fmtPct(pct(v, atual.total))})`, "Vendas"]}
              />
              <Bar dataKey="vendas" name="Vendas" radius={[6, 6, 0, 0]} animationDuration={900}>
                {data.map((d, i) => (
                  <Cell key={d.day} fill={MONDAY_FIRST[i] === melhor ? "hsl(var(--primary))" : "hsl(var(--data-blue))"} />
                ))}
                <LabelList dataKey="vendas" position="top" formatter={(v: number) => (v > 0 ? v.toLocaleString("pt-BR") : "")} className="fill-foreground text-[11px]" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhuma venda ainda</p>
        )}
    </div>
  );
}
