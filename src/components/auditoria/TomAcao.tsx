import { cn } from "@/lib/utils";
import { descreverAcao, type Tom } from "@/lib/activityLog";

// Cor é apoio: criou em verde, alterou em azul, excluiu em vermelho, acessou em cinza. O texto sempre explica.
const CORES: Record<Tom, string> = {
  criou: "text-ok",
  alterou: "text-data-blue",
  excluiu: "text-bad",
  acessou: "text-muted-foreground",
};
const PONTOS: Record<Tom, string> = {
  criou: "bg-ok",
  alterou: "bg-data-blue",
  excluiu: "bg-bad",
  acessou: "bg-muted-foreground/60",
};

export function TomAcao({ acao, className }: { acao: string; className?: string }) {
  const { texto, tom } = descreverAcao(acao);
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", CORES[tom], className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PONTOS[tom])} aria-hidden />
      {texto}
    </span>
  );
}
