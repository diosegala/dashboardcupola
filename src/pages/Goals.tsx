import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isAfter, isBefore, differenceInDays } from "date-fns";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useGoals } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { getMetricLabel } from "@/lib/goalMetrics";
import { GoalFormDialog, type GoalFormValues } from "@/components/goals/GoalFormDialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type GoalStatus = "active" | "expired" | "future";

function getGoalStatus(start: string, end: string): GoalStatus {
  const today = new Date();
  const s = parseISO(start);
  const e = parseISO(end);
  if (isBefore(today, s)) return "future";
  if (isAfter(today, e)) return "expired";
  return "active";
}

const statusConfig: Record<GoalStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  expired: { label: "Expirada", variant: "secondary" },
  future: { label: "Futura", variant: "outline" },
};

function getGoalType(start: string, end: string): string {
  const days = differenceInDays(parseISO(end), parseISO(start)) + 1;
  if (days <= 7) return "Semanal";
  if (days <= 31) return "Mensal";
  return "Personalizado";
}

export default function Goals() {
  const { user, isAdmin } = useAuth();
  const { data: goals, isLoading } = useGoals();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const upsertMutation = useMutation({
    mutationFn: async (values: GoalFormValues & { id?: string }) => {
      const base = {
        label: values.label,
        metric_key: values.metric_key,
        target_value: values.target_value,
        period_start: format(values.period_start, "yyyy-MM-dd"),
        period_end: format(values.period_end, "yyyy-MM-dd"),
      };

      if (values.id) {
        const { error } = await supabase.from("goals").update(base).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert([{ ...base, created_by: user!.id }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setFormOpen(false);
      setEditingGoal(null);
      toast.success(editingGoal ? "Meta atualizada" : "Meta criada");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar meta: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setDeletingGoalId(null);
      toast.success("Meta excluída");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir meta: " + err.message);
    },
  });

  const handleCreate = () => {
    setEditingGoal(null);
    setFormOpen(true);
  };

  const handleEdit = (goal: any) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleSubmit = (values: GoalFormValues) => {
    upsertMutation.mutate({ ...values, id: editingGoal?.id });
  };

  const defaultValues = editingGoal
    ? {
        label: editingGoal.label,
        metric_key: editingGoal.metric_key,
        target_value: Number(editingGoal.target_value),
        period_start: parseISO(editingGoal.period_start),
        period_end: parseISO(editingGoal.period_end),
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-muted-foreground">Gerencie as metas de vendas e marketing</p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Meta
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !goals?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma meta configurada</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Clique em \"Nova Meta\" para começar." : "O administrador ainda não criou metas."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Valor-alvo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                {isAdmin && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => {
                const status = getGoalStatus(goal.period_start, goal.period_end);
                const cfg = statusConfig[status];
                const progress = status === "active" ? null : null; // Progress calculation would need dashboard data

                return (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">{goal.label}</TableCell>
                    <TableCell>{getMetricLabel(goal.metric_key)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(goal.target_value).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(goal.period_start), "dd/MM/yyyy")} – {format(parseISO(goal.period_end), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {status === "active" ? (
                        <Progress value={0} className="h-2" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingGoalId(goal.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        defaultValues={defaultValues}
        isSubmitting={upsertMutation.isPending}
      />

      <AlertDialog open={!!deletingGoalId} onOpenChange={(o) => !o && setDeletingGoalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A meta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGoalId && deleteMutation.mutate(deletingGoalId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
