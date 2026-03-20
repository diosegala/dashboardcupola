import { useState, useEffect } from "react";
import {
  format,
  subDays,
  subMonths,
  subQuarters,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfDay,
  endOfDay,
  isSameDay,
} from "date-fns";
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
  { label: "Hoje", getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Ontem", getRange: () => { const d = subDays(new Date(), 1); return { from: startOfDay(d), to: endOfDay(d) }; } },
  { label: "Esta semana", getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: "Semana passada", getRange: () => { const prev = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7); return { from: prev, to: endOfWeek(prev, { weekStartsOn: 1 }) }; } },
  { label: "Este mês", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Mês passado", getRange: () => { const prev = subMonths(new Date(), 1); return { from: startOfMonth(prev), to: endOfMonth(prev) }; } },
  { label: "Este trimestre", getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: "Trimestre passado", getRange: () => { const prev = subQuarters(new Date(), 1); return { from: startOfQuarter(prev), to: endOfQuarter(prev) }; } },
  { label: "Todo o período", getRange: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
];

function isPresetActive(range: DateRange, preset: { getRange: () => DateRange }) {
  const p = preset.getRange();
  return isSameDay(range.from, p.from) && isSameDay(range.to, p.to);
}

export function PeriodSelector({ range, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(range);

  useEffect(() => {
    setTempRange(range);
  }, [range]);

  const handlePreset = (preset: { getRange: () => DateRange }) => {
    const r = preset.getRange();
    onChange(r);
    setOpen(false);
  };

  const handleApply = () => {
    onChange(tempRange);
    setOpen(false);
  };

  const handleClear = () => {
    setTempRange(range);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal gap-2")}>
          <CalendarIcon className="h-4 w-4" />
          {format(range.from, "dd MMM", { locale: ptBR })} – {format(range.to, "dd MMM yyyy", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets */}
          <div className="flex flex-col gap-0.5 p-3 border-r min-w-[160px]">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant={isPresetActive(range, p) ? "secondary" : "ghost"}
                size="sm"
                className="justify-start text-sm h-8"
                onClick={() => handlePreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={{ from: tempRange.from, to: tempRange.to }}
              onSelect={(r) => {
                if (r?.from && r?.to) setTempRange({ from: r.from, to: r.to });
                else if (r?.from) setTempRange({ from: r.from, to: r.from });
              }}
              numberOfMonths={2}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
            <Separator />
            <div className="flex justify-end gap-2 p-3">
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Limpar
              </Button>
              <Button size="sm" onClick={handleApply}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
