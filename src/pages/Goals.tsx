import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GoalEditor, type GoalEditorValues } from "@/components/goals/GoalEditor";
import { goalsOfEvent, useEvent } from "@/hooks/useEvent";
import { useGoals } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GOAL_DEFS, GOAL_SECTIONS, defOfGoal, formatGoalValue, type GoalDef } from "@/lib/goalMetrics";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  metric_key: string;
  label: string;
  target_value: number | string;
  period_start: string;
  period_end: string;
  ticket_type?: string | null;
  created_at?: string | null;
};

const data = (d: string) => format(parseISO(d), "dd/MM/yy");

// Metas do catálogo: um só lugar para criar, ver e alterar. Só administradores editam; os demais só consultam.
export default function Goals() {
  const { user, isAdmin } = useAuth();
  const { event } = useEvent();
  const { data: todas, isLoading } = useGoals();
  const goals = useMemo(() => (todas ? (goalsOfEvent(todas, event) as Goal[]) : []), [todas, event]);
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState<{ def: GoalDef; goal: Goal | null } | null>(null);
  const [excluindo, setExcluindo] = useState<Goal | null>(null);

  // Metas de cada item do catálogo; as que não batem com nenhum item vão para "Outras metas".
  const porItem = useMemo(() => {
    const map = new Map<string, Goal[]>();
    const soltas: Goal[] = [];
    goals.forEach((g) => {
      const def = defOfGoal(g);
      if (!def) return soltas.push(g);
      map.set(def.id, [...(map.get(def.id) ?? []), g]);
    });
    map.forEach((lista) => lista.sort((a, b) => a.period_start.localeCompare(b.period_start) || String(a.ticket_type ?? "").localeCompare(String(b.ticket_type ?? ""))));
    return { map, soltas };
  }, [goals]);

  const salvar = useMutation({
    mutationFn: async ({ def, goal, v }: { def: GoalDef; goal: Goal | null; v: GoalEditorValues }) => {
      const linha = {
        label: v.ticket_type ? `${def.label} · ${v.ticket_type}` : def.label,
        metric_key: def.key,
        target_value: v.target_value,
        period_start: v.period_start,
        period_end: v.period_end,
        ticket_type: v.ticket_type,
        ...(event.id ? { event_id: event.id } : {}),
      } as any;
      const { error } = goal
        ? await supabase.from("goals").update(linha).eq("id", goal.id)
        : await supabase.from("goals").insert([{ ...linha, created_by: user!.id }]);
      if (error) throw error;
    },
    onSuccess: (_, { goal }) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setEditando(null);
      toast.success(goal ? "Meta alterada" : "Meta definida");
    },
    onError: (err: any) => toast.error(`Não deu para salvar a meta: ${err.message}`),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setExcluindo(null);
      toast.success("Meta removida. O gráfico volta a aparecer sem meta.");
    },
    onError: (err: any) => toast.error(`Não deu para remover a meta: ${err.message}`),
  });

  const definidas = GOAL_DEFS.filter((d) => (porItem.map.get(d.id) ?? []).length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas"
        description={
          <>
            Todas as metas do painel ficam aqui. Gráfico sem meta aparece normalmente; com meta, ganha a marca de progresso. Meta é diferente da comparação com o ano anterior.
            {!isAdmin && " Só administradores alteram as metas."}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <b className="font-semibold text-foreground">{definidas}</b> de {GOAL_DEFS.length} metas definidas para {event.name}.
          </p>

          {GOAL_SECTIONS.map((sec) => (
            <Card key={sec.title} className="overflow-hidden">
              <div className="border-b bg-secondary/40 px-5 py-3">
                <h2 className="text-[15px] font-semibold">{sec.title}</h2>
                <p className="text-xs text-muted-foreground">{sec.description}</p>
              </div>
              <ul>
                {sec.items.map((def) => {
                  const lista = porItem.map.get(def.id) ?? [];
                  const varias = def.scope !== "evento";
                  return (
                    <li key={def.id} className="grid gap-3 border-b px-5 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{def.label}</div>
                        <div className="truncate text-xs text-muted-foreground" title={def.where}>Aparece em: {def.where}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lista.length === 0 ? (
                          <span className="text-xs text-muted-foreground/80">Sem meta</span>
                        ) : (
                          lista.map((g) => (
                            <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-3 pr-1 text-xs">
                              <i className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                              {g.ticket_type && <span className="max-w-[160px] truncate text-muted-foreground" title={g.ticket_type}>{g.ticket_type}:</span>}
                              <b className="font-semibold tabular-nums">{formatGoalValue(Number(g.target_value), def.unit)}</b>
                              <span className="text-muted-foreground">{data(g.period_start)}–{data(g.period_end)}</span>
                              {isAdmin ? (
                                <>
                                  <button type="button" onClick={() => setEditando({ def, goal: g })} title="Alterar meta" className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button type="button" onClick={() => setExcluindo(g)} title="Remover meta" className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              ) : (
                                <span className="pr-2" />
                              )}
                            </span>
                          ))
                        )}
                      </div>
                      {isAdmin && (lista.length === 0 || varias) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("w-fit rounded-full", lista.length === 0 && "border-primary/60")}
                          onClick={() => setEditando({ def, goal: null })}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {lista.length === 0 ? "Definir" : def.scope === "lote" ? "Outro lote" : "Outro período"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}

          {porItem.soltas.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b bg-secondary/40 px-5 py-3">
                <h2 className="text-[15px] font-semibold">Outras metas</h2>
                <p className="text-xs text-muted-foreground">Metas antigas de métricas que não aparecem em nenhum gráfico hoje. Podem ser removidas.</p>
              </div>
              <ul>
                {porItem.soltas.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm last:border-b-0">
                    <span>
                      <b className="font-semibold">{g.label}</b>{" "}
                      <span className="text-muted-foreground">
                        {Number(g.target_value).toLocaleString("pt-BR")} · {data(g.period_start)}–{data(g.period_end)}
                      </span>
                    </span>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => setExcluindo(g)}>
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <GoalEditor
        open={!!editando}
        def={editando?.def ?? null}
        goal={editando?.goal ?? null}
        eventEnd={event.end_date}
        saving={salvar.isPending}
        onClose={() => setEditando(null)}
        onSave={(v) => editando && salvar.mutate({ def: editando.def, goal: editando.goal, v })}
      />

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta meta?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.label}: o gráfico volta a aparecer sem a marca de meta. Dá para definir de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
