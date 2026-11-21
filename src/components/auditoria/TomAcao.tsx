import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { descreverAcao, type Tom } from "@/lib/activityLog";

// Cor é apoio: criou em verde, alterou em azul, excluiu em grafite, acessou em cinza.
// Vermelho fica só para o que realmente falhou — excluir é uma ação normal, não um erro.
const CORES: Record<Tom, string> = {
  criou: "text-ok",
  alterou: "text-data-blue",
  excluiu: "text-foreground/80",
  acessou: "text-muted-foreground",
};
const PONTOS: Record<Tom, string> = {
  criou: "bg-ok",
  alterou: "bg-data-blue",
  excluiu: "bg-foreground/50",
  acessou: "bg-muted-foreground/60",
};

// Quando não deu certo, o alerta substitui a bolinha: a falha fica visível sem um selo a mais.
export function TomAcao({ acao, erro, className }: { acao: string; erro?: boolean; className?: string }) {
  const { texto, tom } = descreverAcao(acao);
  return (
    <span className={cn("flex min-w-0 items-start gap-1.5 font-medium", erro ? "text-bad" : CORES[tom], className)}>
      {erro ? (
        <AlertTriangle className="mt-[3px] h-3 w-3 shrink-0" aria-label="Não deu certo" />
      ) : (
        <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", PONTOS[tom])} aria-hidden />
      )}
      <span className="min-w-0 break-words">{texto}</span>
    </span>
  );
}
