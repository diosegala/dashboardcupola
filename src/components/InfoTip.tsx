import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METRIC_INFO } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  // Título exibido em negrito; também é a chave para buscar a definição em METRIC_INFO.
  title: string;
  text?: string;
  className?: string;
}

// Botão "i" discreto: 35% de opacidade, 60% com o card em hover e 100% no próprio botão.
// Abre no hover, no foco do teclado e no toque.
export function InfoTip({ title, text, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const definicao = text ?? METRIC_INFO[title];
  if (!definicao) return null;

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={80}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`O que é ${title}`}
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
          className={cn(
            "inline-grid h-[13px] w-[13px] shrink-0 cursor-help place-items-center rounded-full border border-current p-0 align-middle text-[8px] font-semibold leading-none text-muted-foreground opacity-35 transition-opacity duration-150 group-hover/card:opacity-60 hover:text-foreground hover:!opacity-100 focus-visible:text-foreground focus-visible:!opacity-100 focus-visible:outline-none",
            className,
          )}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[280px] rounded-xl border-0 bg-foreground px-3.5 py-3 text-[13px] font-normal leading-[1.45] text-background shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)]"
      >
        <b className="mb-1 block font-semibold">{title}</b>
        {definicao}
      </TooltipContent>
    </Tooltip>
  );
}
