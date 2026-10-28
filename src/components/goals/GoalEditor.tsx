import { useEffect, useState } from "react";
import { addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTicketTypes } from "@/hooks/useTicketTypes";
import type { GoalDef } from "@/lib/goalMetrics";
import { cn } from "@/lib/utils";

export interface GoalEditorValues {
  target_value: number;
  period_start: string;
  period_end: string;
  ticket_type: string | null;
}

interface GoalEditorProps {
  open: boolean;
  def: GoalDef | null;
  // Meta existente (para alterar) ou null (nova).
  goal: { target_value: number | string; period_start: string; period_end: string; ticket_type?: string | null } | null;
  // Datas padrão de uma meta do evento: de hoje até o fim do evento.
  eventEnd: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: GoalEditorValues) => void;
}

const dia = (d: Date) => format(d, "yyyy-MM-dd");

// Atalhos de período para metas de marketing e do funil.
function atalhos() {
  const hoje = new Date();
  const semanas = [0, 1, 2, 3].map((i) => {
    const de = startOfWeek(addWeeks(hoje, i), { weekStartsOn: 4 });
    const ate = endOfWeek(addWeeks(hoje, i), { weekStartsOn: 4 });
    return { rotulo: `Semana ${format(de, "dd/MM")}–${format(ate, "dd/MM")}`, de: dia(de), ate: dia(ate) };
  });
  const meses = [0, 1, 2].map((i) => {
    const m = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    return { rotulo: format(m, "MMMM yyyy", { locale: ptBR }), de: dia(startOfMonth(m)), ate: dia(endOfMonth(m)) };
  });
  return [...semanas, ...meses];
}

// Editor de uma meta do catálogo: a métrica já vem escolhida, então só pede valor, datas e (se for o caso) o lote.
export function GoalEditor({ open, def, goal, eventEnd, saving, onClose, onSave }: GoalEditorProps) {
  const { data: lotes = [] } = useTicketTypes();
  const [valor, setValor] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [lote, setLote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValor(goal ? String(Number(goal.target_value)) : "");
    setDe(goal?.period_start ?? dia(new Date()));
    setAte(goal?.period_end ?? (def?.scope === "periodo" ? dia(endOfWeek(new Date(), { weekStartsOn: 4 })) : eventEnd));
    setLote(goal?.ticket_type ?? null);
  }, [open, goal, def, eventEnd]);

  if (!def) return null;
  const numero = Number(valor.replace(",", "."));
  const valido = numero > 0 && !!de && !!ate && ate >= de && (def.scope !== "lote" || !!lote);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{goal ? "Alterar meta" : "Definir meta"}: {def.label}</DialogTitle>
          <DialogDescription>Aparece em: {def.where}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) onSave({ target_value: numero, period_start: de, period_end: ate, ticket_type: def.scope === "lote" ? lote : null });
          }}
        >
          {def.scope === "lote" && (
            <div className="space-y-2">
              <Label>Lote</Label>
              <Select value={lote ?? ""} onValueChange={setLote}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meta-valor">Valor da meta</Label>
            <div className="relative">
              {def.unit === "brl" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>}
              <Input
                id="meta-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={def.unit === "pct" ? "Ex.: 2,5" : def.unit === "brl" ? "Ex.: 500000" : "Ex.: 2000"}
                className={cn(def.unit === "brl" && "pl-10", def.unit === "pct" && "pr-9")}
                autoFocus
              />
              {def.unit === "pct" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}
            </div>
          </div>

          {def.scope === "periodo" && (
            <div className="space-y-2">
              <Label>Atalhos</Label>
              <div className="flex flex-wrap gap-1.5">
                {atalhos().map((a) => (
                  <button
                    key={a.rotulo}
                    type="button"
                    onClick={() => { setDe(a.de); setAte(a.ate); }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      de === a.de && ate === a.ate ? "border-foreground bg-foreground text-background" : "hover:bg-secondary",
                    )}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="meta-de">{def.scope === "periodo" ? "De" : "Vale de"}</Label>
              <Input id="meta-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-ate">Até</Label>
              <Input id="meta-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </div>
          {def.scope !== "periodo" && (
            <p className="-mt-2 text-xs text-muted-foreground">As datas servem para mostrar se o ritmo está bom; o padrão é de hoje até o fim do evento.</p>
          )}
          {ate && de && ate < de && <p className="text-xs text-destructive">A data final precisa ser depois da inicial.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!valido || saving}>{saving ? "Salvando…" : "Salvar meta"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
