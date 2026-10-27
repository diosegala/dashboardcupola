import { cn } from "@/lib/utils";

// Logo horizontal: nome preto no tema claro e branco no escuro, símbolo sempre lima.
export function CupolaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      <img src="/brand/logo-cupola-hor-preto.svg" alt="CUPOLA" className="h-full w-auto dark:hidden" />
      <img src="/brand/logo-cupola-hor-branco.svg" alt="CUPOLA" className="hidden h-full w-auto dark:block" />
    </span>
  );
}
