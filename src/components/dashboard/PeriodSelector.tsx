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
  // No calendário, o primeiro clique sempre começa um período novo e o segundo fecha; sem isso o clique
  // emendava no período anterior (escolher maio com novembro selecionado virava maio a novembro).
  const [escolhendoFim, setEscolhendoFim] = useState(false);

  useEffect(() => {
    setTempRange(range);
  }, [range]);

  useEffect(() => {
    if (open) setEscolhendoFim(false);
  }, [open]);

  const handleDay = (day: Date) => {
    if (!escolhendoFim) {
      setTempRange({ from: startOfDay(day), to: endOfDay(day) });
      setEscolhendoFim(true);
      return;
    }
    const inicio = day < tempRange.from ? day : tempRange.from;
    const fim = day < tempRange.from ? tempRange.from : day;
    setTempRange({ from: startOfDay(inicio), to: endOfDay(fim) });
    setEscolhendoFim(false);
  };

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
    setEscolhendoFim(false);
  };

  const todoPeriodo = isPresetActive(range, presets[presets.length - 1]) || range.from.getFullYear() <= 2020;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 justify-start gap-2 rounded-full px-3.5 text-left text-xs font-medium")}>
          <CalendarIcon className="h-3.5 w-3.5" />
          {todoPeriodo ? "Todo o período" : `${format(range.from, "dd MMM", { locale: ptBR })} – ${format(range.to, "dd MMM yyyy", { locale: ptBR })}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-16px)] overflow-y-auto p-0" align="end" collisionPadding={8}>
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="flex flex-row flex-wrap gap-0.5 border-b p-3 sm:min-w-[160px] sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
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
              onSelect={(_, day) => day && handleDay(day)}
              defaultMonth={tempRange.from.getFullYear() <= 2020 ? undefined : tempRange.from}
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
