import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Chips do ds-summit. Verde, âmbar e vermelho só indicam situação.
const variants = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  neutral: "bg-secondary text-foreground/75",
  paid: "bg-primary text-primary-foreground",
  blue: "bg-data-blue/10 text-data-blue",
  lavender: "bg-chart-4/25 text-foreground/80",
} as const;

export type ChipVariant = keyof typeof variants;

interface ChipProps {
  variant?: ChipVariant;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Chip({ variant = "neutral", dot = true, className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
