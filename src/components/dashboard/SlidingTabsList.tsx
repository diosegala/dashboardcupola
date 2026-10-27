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
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const ativo = listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (ativo) setInd({ left: ativo.offsetLeft, width: ativo.offsetWidth });
    };
    medir();
    window.addEventListener("resize", medir);
    document.fonts?.ready.then(medir);
    return () => window.removeEventListener("resize", medir);
  }, [value]);

  return (
    <TabsList ref={listRef} className={cn("relative", className)}>
      {ind && (
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-full bg-foreground transition-[left,width] duration-300 ease-cupola motion-reduce:transition-none"
          style={{ left: ind.left, width: ind.width }}
        />
      )}
      {children}
    </TabsList>
  );
}
