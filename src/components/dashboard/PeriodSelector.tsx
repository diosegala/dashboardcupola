import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { DateRange } from "@/hooks/useDashboardData";

interface PeriodSelectorProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
}

const presets: { label: string; getRange: () => DateRange }[] = [
  { label: "Últimos 7 dias", getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Esta semana", getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Semana passada", getRange: () => { const prev = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7); return { from: prev, to: endOfWeek(prev, { weekStartsOn: 1 }) }; } },
  { label: "Últimos 30 dias", getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Este mês", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Mês passado", getRange: () => { const prev = subMonths(new Date(), 1); return { from: startOfMonth(prev), to: endOfMonth(prev) }; } },
  { label: "Todo o período", getRange: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
];

export function PeriodSelector({ range, onChange }: PeriodSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal gap-2")}>
          <CalendarIcon className="h-4 w-4" />
          {format(range.from, "dd MMM", { locale: ptBR })} – {format(range.to, "dd MMM yyyy", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col gap-1 p-3">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              className="justify-start text-sm"
              onClick={() => onChange(p.getRange())}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Separator />
        <Calendar
          mode="range"
          selected={{ from: range.from, to: range.to }}
          onSelect={(r) => {
            if (r?.from && r?.to) onChange({ from: r.from, to: r.to });
            else if (r?.from) onChange({ from: r.from, to: r.from });
          }}
          numberOfMonths={2}
          locale={ptBR}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
