import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Chip } from "@/components/Chip";
import { useAuth } from "@/hooks/useAuth";
import type { Lote } from "@/lib/batchSummary";
import { cn } from "@/lib/utils";

// "2026-11-09" → "09/11/2026"
export const dataCurta = (d: string) => d.split("-").reverse().join("/");

// Selos do lote: Vigente, Encerrado ou Não iniciado (pelas datas da configuração) e Meta atingida.
export function LoteSelos({ lote, vigente, pequeno }: { lote: Pick<Lote, "situacao" | "metaAtingida">; vigente?: boolean; pequeno?: boolean }) {
  const cls = cn(pequeno && "px-1.5 py-0 text-[10px]");
  return (
    <>
      {vigente ? (
        <Chip variant="paid" dot={false} className={cls}>Vigente</Chip>
      ) : lote.situacao === "encerrado" ? (
        <Chip variant="neutral" dot={false} className={cls}>Encerrado</Chip>
      ) : lote.situacao === "nao_iniciado" ? (
        <Chip variant="blue" dot={false} className={cls}>Não iniciado</Chip>
      ) : null}
      {lote.metaAtingida && <Chip variant="ok" dot={false} className={cls}>Meta atingida</Chip>}
    </>
  );
}

// Algum lote sem data: o painel não escolhe o vigente por conta própria.
export function AvisoDatas({ compacto }: { compacto?: boolean }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <p className={cn("text-xs text-muted-foreground", !compacto && "py-8 text-center")}>Lote vigente não definido.</p>;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg bg-warn-bg p-3 text-xs text-warn", !compacto && "my-4")}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Faltam datas na configuração de lotes, então o lote vigente não foi definido.{" "}
        <Link to="/settings" className="font-semibold underline">Completar em Configurações › Eventos › Lotes</Link>
      </span>
    </div>
  );
}
