import { cn } from "@/lib/utils";

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  shape?: "line" | "dashed" | "square";
}

interface ChartLegendProps {
  items: LegendItem[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onFocus: (key: string | null) => void;
  className?: string;
}

// Legenda interativa do ds-summit: hover destaca a série, clique oculta ou mostra.
export function ChartLegend({ items, hidden, onToggle, onFocus, className }: ChartLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-3.5 text-xs text-foreground/75", className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={!hidden.has(item.key)}
          onClick={() => onToggle(item.key)}
          onMouseEnter={() => onFocus(item.key)}
          onMouseLeave={() => onFocus(null)}
          onFocus={() => onFocus(item.key)}
          onBlur={() => onFocus(null)}
          className={cn(
            "-mx-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-[background-color,opacity] duration-150 hover:bg-secondary",
            hidden.has(item.key) && "opacity-35",
          )}
        >
          {item.shape === "dashed" ? (
            <i
              className="inline-block h-0.5 w-4"
              style={{ background: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)` }}
            />
          ) : item.shape === "line" ? (
            <i className="inline-block h-0.5 w-3.5 rounded-sm" style={{ background: item.color }} />
          ) : (
            <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
          )}
          {item.label}
        </button>
      ))}
    </div>
  );
}
