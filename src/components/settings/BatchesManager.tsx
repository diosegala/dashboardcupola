import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEvent } from "@/hooks/useEvent";
import { EVENT_BATCHES_KEY, useEventBatches } from "@/hooks/useEventBatches";
import { traduzirErro } from "@/lib/mensagensErro";

interface Linha {
  id?: string;
  name: string;
  start_date: string;
  end_date: string;
  sort_order: number;
}

// Problemas de datas: término antes do início, período sobreposto a outro lote ou data faltando.
function problemas(linhas: Linha[]) {
  const p = new Map<number, string>();
  linhas.forEach((l, i) => {
    if (!l.start_date || !l.end_date) p.set(i, "Falta data");
    else if (l.end_date < l.start_date) p.set(i, "Término antes do início");
    else {
      const outro = linhas.find((o, j) => j !== i && o.start_date && o.end_date && o.start_date <= l.end_date && l.start_date <= o.end_date);
      if (outro) p.set(i, `Sobrepõe ${outro.name || "outro lote"}`);
    }
  });
  return p;
}

// Datas de cada lote do evento: definem o lote vigente e o lote de cada venda no painel.
export function BatchesManager() {
  const { events, event } = useEvent();
  const [eventId, setEventId] = useState<string>(event.id ?? "");
  const { data } = useEventBatches();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    setLinhas(
      (data ?? [])
        .filter((b) => b.event_id === eventId)
        .map((b) => ({ id: b.id, name: b.name, start_date: b.start_date ?? "", end_date: b.end_date ?? "", sort_order: b.sort_order ?? 0 })),
    );
  }, [data, eventId]);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: EVENT_BATCHES_KEY });
  const salvar = useMutation({
    mutationFn: async (l: Linha) => {
      const row = { event_id: eventId, name: l.name.trim(), start_date: l.start_date || null, end_date: l.end_date || null, sort_order: l.sort_order };
      const { error } = l.id ? await supabase.from("event_batches").update(row).eq("id", l.id) : await supabase.from("event_batches").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lote salvo. O painel já usa as novas datas."); atualizar(); },
    onError: (e: Error) => toast.error(traduzirErro(e)),
  });
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lote excluído."); atualizar(); },
    onError: (e: Error) => toast.error(traduzirErro(e)),
  });

  const muda = (i: number, campo: keyof Linha, v: string) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const avisos = problemas(linhas);
  const proximo = linhas.length ? Math.max(...linhas.map((l) => l.sort_order)) + 1 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> Lotes</CardTitle>
          <CardDescription>
            Início e término de cada lote, incluídos no período. O lote vigente troca à meia-noite (Brasília) do dia de início.
            Fora de qualquer lote, vale o próximo a começar.
          </CardDescription>
        </div>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Evento" /></SelectTrigger>
          <SelectContent>
            {events.filter((e) => e.id).map((e) => <SelectItem key={e.id!} value={e.id!}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={l.id ?? `novo-${i}`}>
                  <TableCell><Input className="h-9 w-[130px]" value={l.name} onChange={(e) => muda(i, "name", e.target.value)} /></TableCell>
                  <TableCell><Input type="date" className="h-9 w-[160px]" value={l.start_date} onChange={(e) => muda(i, "start_date", e.target.value)} /></TableCell>
                  <TableCell><Input type="date" className="h-9 w-[160px]" value={l.end_date} onChange={(e) => muda(i, "end_date", e.target.value)} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {avisos.get(i) && <span className="text-xs text-warn">{avisos.get(i)}</span>}
                      <Button size="icon" variant="ghost" aria-label="Salvar lote" disabled={!l.name.trim() || salvar.isPending} onClick={() => salvar.mutate(l)}>
                        <Save className="h-4 w-4" />
                      </Button>
                      {l.id ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Excluir lote"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir {l.name}?</AlertDialogTitle>
                              <AlertDialogDescription>As vendas continuam no painel; só as datas deste lote deixam de valer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => excluir.mutate(l.id!)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button size="icon" variant="ghost" aria-label="Descartar" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" disabled={!eventId} onClick={() => setLinhas((ls) => [...ls, { name: `Lote ${proximo}`, start_date: "", end_date: "", sort_order: proximo }])}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar lote
        </Button>
      </CardContent>
    </Card>
  );
}
