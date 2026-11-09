import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SlidingTabsListProps {
  // Valor da aba ativa, usado só para reposicionar o indicador.
  value: string;
  className?: string;
  children: ReactNode;
}

// Lista de abas em pílula com indicador preto que desliza até a aba ativa (ds-summit).
export function SlidingTabsList({ value, className, children }: SlidingTabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ left: number; width: number; top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const ativo = listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (ativo) setInd({ left: ativo.offsetLeft, width: ativo.offsetWidth, top: ativo.offsetTop, height: ativo.offsetHeight });
    };
    medir();
    window.addEventListener("resize", medir);
    document.fonts?.ready.then(medir);
    // A lista pode quebrar em mais linhas quando o card estreita: remede junto.
    const ro = typeof ResizeObserver !== "undefined" && listRef.current ? new ResizeObserver(medir) : null;
    if (ro && listRef.current) ro.observe(listRef.current);
    return () => {
      window.removeEventListener("resize", medir);
      ro?.disconnect();
    };
  }, [value]);

  return (
    <TabsList ref={listRef} className={cn("relative", className)}>
      {ind && (
        <span
          aria-hidden
          className="absolute rounded-full bg-foreground transition-[left,width,top] duration-300 ease-cupola motion-reduce:transition-none"
          style={{ left: ind.left, width: ind.width, top: ind.top, height: ind.height }}
        />
      )}
      {children}
    </TabsList>
  );
}
