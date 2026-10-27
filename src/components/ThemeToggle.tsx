import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const escuro = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label="Alternar tema claro e escuro"
      title={escuro ? "Usar tema claro" : "Usar tema escuro"}
      className={cn(
        "relative h-8 w-16 shrink-0 rounded-full border border-line-strong bg-secondary p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] grid h-6 w-6 place-items-center rounded-full transition-[transform,background-color] duration-300 [transition-timing-function:cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none",
          escuro ? "translate-x-8 bg-primary text-primary-foreground" : "bg-foreground text-background",
        )}
      >
        {escuro ? <Moon className="h-3.5 w-3.5" strokeWidth={2} /> : <Sun className="h-3.5 w-3.5" strokeWidth={2} />}
      </span>
    </button>
  );
}
