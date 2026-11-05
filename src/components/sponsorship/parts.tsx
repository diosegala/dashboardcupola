import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import type { FieldStatus } from "@/lib/sponsorshipExtra";
import { cn } from "@/lib/utils";

// Texto de cada situação de campo: o que falta fazer no Pipedrive.
export function fieldStatusText(f: FieldStatus): string | null {
  switch (f.state) {
    case "nao_lida":
      return `${f.label}: a conta do Pipedrive ainda não foi lida na configuração do evento, então não dá para saber se o campo existe.`;
    case "nao_existe":
      return `${f.label}: o campo não existe no Pipedrive. Criar o campo.`;
    case "vazio":
      return `${f.label}: o campo "${f.nome}" existe, mas está vazio ${f.total === 1 ? "na venda" : `nas ${f.total} vendas`} desta edição. Preencher no Pipedrive.`;
    case "parcial":
      return `${f.label}: o campo "${f.nome}" está preenchido em ${f.preenchidos} de ${f.total} vendas. Completar no Pipedrive.`;
    default:
      return null;
  }
}

// Aviso discreto de "investigar no CRM": campos que não existem ou estão vazios, mais notas do próprio card.
export function CrmWarning({ fields = [], notes = [], className }: { fields?: (FieldStatus | undefined)[]; notes?: (string | null | false | undefined)[]; className?: string }) {
  const lista = fields.filter(Boolean) as FieldStatus[];
  // Conta ainda não lida: uma linha só, com todas as informações que ficam para conferir.
  const naoLidas = lista.filter((f) => f.state === "nao_lida").map((f) => f.label);
  const linhas = [
    naoLidas.length
      ? `A conta do Pipedrive ainda não foi lida na configuração do evento, então ainda não dá para saber se estes campos existem: ${naoLidas.join(", ")}.`
      : null,
    ...lista.filter((f) => f.state !== "nao_lida").map(fieldStatusText),
    ...notes,
  ].filter(Boolean) as string[];
  if (!linhas.length) return null;
  return (
    <div className={cn("rounded-xl border border-dashed border-warn/50 bg-warn-bg/40 px-3 py-2 text-xs text-foreground/80", className)}>
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-warn">
        <Search className="h-3.5 w-3.5" />
        Para investigar no CRM
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function MiniStat({ label, value, info, sub, tone }: { label: string; value: ReactNode; info: string; sub?: ReactNode; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {label}
        <InfoTip title={label} text={info} />
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
      {sub && <div className={cn("text-[11px] text-muted-foreground", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{sub}</div>}
    </div>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  text: string;
  sub?: string;
  tone?: "warn" | "muted";
}

// Lista de barras horizontais: o gráfico de quantidades dos cards.
export function BarList({ items, color = "bg-primary", empty = "Nada para mostrar ainda." }: { items: BarItem[]; color?: string; empty?: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={cn("min-w-0 truncate font-medium", i.tone === "muted" && "text-muted-foreground")} title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{i.text}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full transition-[width] duration-700 ease-cupola", i.tone === "warn" ? "bg-warn" : color)} style={{ width: `${max > 0 ? (i.value / max) * 100 : 0}%` }} />
          </div>
          {i.sub && <div className="text-[11px] text-muted-foreground">{i.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// Botão "Ver detalhes" padrão dos cards.
export function DetailsToggle({ open, onToggle, count }: { open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-secondary">
      {open ? "Ocultar detalhes" : count != null ? `Ver detalhes (${count})` : "Ver detalhes"}
    </button>
  );
}

export const brlShort = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
