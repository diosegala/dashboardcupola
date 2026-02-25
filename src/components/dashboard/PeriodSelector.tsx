import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Infinity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "@/hooks/useDashboardData";

interface PeriodSelectorProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onSelectAllTime?: () => void;
}

export function PeriodSelector({ range, onChange, onSelectAllTime }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {onSelectAllTime && (
        <Button variant="outline" className="gap-2" onClick={onSelectAllTime}>
          <Infinity className="h-4 w-4" />
          Todo período
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start text-left font-normal gap-2")}>
            <CalendarIcon className="h-4 w-4" />
            {format(range.from, "dd MMM", { locale: ptBR })} – {format(range.to, "dd MMM yyyy", { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
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
    </div>
  );
}
