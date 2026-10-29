import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useCompare } from "@/hooks/useCompare";
import { cn } from "@/lib/utils";

interface CompareLineProps {
  // Valor do ano anterior no mesmo ponto (mesma data ou mesmo período).
  anterior: number | null | undefined;
  atual: number;
  formato?: (n: number) => string;
  // Texto do ponto de comparação: "na mesma data", "no mesmo período", "no mesmo lote".
  quando?: string;
  className?: string;
  escuro?: boolean;
}

// Linha discreta do ano anterior, igual em todos os cards: tracinho cinza, valor de lá e a variação.
// Só aparece com a chave "Comparar" ligada e quando existe o dado do ano anterior.
export function CompareLine({ anterior, atual, formato = (n) => Math.round(n).toLocaleString("pt-BR"), quando = "na mesma data", className, escuro }: CompareLineProps) {
  const { ativo, rotulo } = useCompare();
  if (!ativo || anterior == null) return null;
  const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
  const subiu = variacao !== null && variacao >= 0;
  return (
    <p className={cn("text-xs", escuro ? "text-[#9A9FA7]" : "text-muted-foreground", className)}>
      <i className={cn("inline-block w-3 border-t-[1.5px] border-dashed", escuro ? "border-[#9A9FA7]" : "border-muted-foreground")} aria-hidden />
      {rotulo} {quando}:<br />
      <b className={cn("font-semibold", escuro ? "text-[#D6D2C8]" : "text-foreground/80")}>{formato(anterior)}</b>
      {variacao !== null && Math.abs(variacao) >= 0.5 && (
        <span className={cn("inline-flex items-center font-semibold", subiu ? "text-ok" : "text-warn")}>
          {subiu ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(variacao).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
        </span>
      )}
    </p>
  );
}
