import { Fragment, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { EventRow } from "@/hooks/useEvent";
import { EVENT_BATCHES_KEY, useEventBatches } from "@/hooks/useEventBatches";
import { traduzirErro } from "@/lib/mensagensErro";
import { CAMPOS_PRECO } from "@/lib/lotPricing";

type Precos = Record<(typeof CAMPOS_PRECO)[number]["campo"], string>;
const vazio = () => Object.fromEntries(CAMPOS_PRECO.map((c) => [c.campo, ""])) as Precos;
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

interface Linha {
  id?: string;
  name: string;
  start_date: string;
  end_date: string;
  sort_order: number;
  precos: Precos;
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
export function BatchesManager({ event, open, onClose }: { event: EventRow | null; open: boolean; onClose: () => void }) {
  const eventId = event?.id ?? "";
  const { data } = useEventBatches();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    setLinhas(
      (data ?? [])
        .filter((b) => b.event_id === eventId)
        .map((b) => ({ id: b.id, name: b.name, start_date: b.start_date ?? "", end_date: b.end_date ?? "", sort_order: b.sort_order ?? 0, precos: Object.fromEntries(CAMPOS_PRECO.map((c) => [c.campo, (b as any)[c.campo] != null ? String((b as any)[c.campo]) : ""])) as Precos })),
    );
  }, [data, eventId, open]);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: EVENT_BATCHES_KEY });
  const salvar = useMutation({
    mutationFn: async (l: Linha) => {
      const row = { event_id: eventId, name: l.name.trim(), start_date: l.start_date || null, end_date: l.end_date || null, sort_order: l.sort_order, ...Object.fromEntries(CAMPOS_PRECO.map((c) => [c.campo, num(l.precos[c.campo])])) };
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

  const mudaPreco = (i: number, campo: keyof Precos, v: string) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, precos: { ...l.precos, [campo]: v } } : l)));
  const [preVenda, setPreVenda] = useState("");
  useEffect(() => { setPreVenda((event as any)?.presale_price != null ? String((event as any).presale_price) : ""); }, [event, open]);
  const salvarPreVenda = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").update({ presale_price: num(preVenda) } as any).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preço da pré-venda salvo."); queryClient.invalidateQueries(); },
    onError: (e: Error) => toast.error(traduzirErro(e)),
  });
  const muda = (i: number, campo: keyof Linha, v: string) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const avisos = problemas(linhas);
  const proximo = linhas.length ? Math.max(...linhas.map((l) => l.sort_order)) + 1 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Lotes de {event?.name}</DialogTitle>
          <DialogDescription>
            Início, término e preços oficiais (valor do comprador, com a taxa) de cada lote. As datas entram no período. O lote vigente troca à meia-noite (Brasília) do dia de início.
            Fora de qualquer lote, vale o próximo a começar.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
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
                <Fragment key={l.id ?? `novo-${i}`}>
                <TableRow className="border-b-0">
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
                <TableRow>
                  <TableCell colSpan={4} className="pt-0">
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {CAMPOS_PRECO.map((c) => (
                        <label key={c.campo} className="text-[11px] text-muted-foreground">
                          {c.rotulo}
                          <Input inputMode="decimal" placeholder="R$" className="mt-0.5 h-8" value={l.precos[c.campo]} onChange={(e) => mudaPreco(i, c.campo, e.target.value.replace(/[^\d.,]/g, ""))} />
                        </label>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <Button variant="outline" size="sm" disabled={!eventId} onClick={() => setLinhas((ls) => [...ls, { name: `Lote ${proximo}`, start_date: "", end_date: "", sort_order: proximo, precos: vazio() }])}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar lote
          </Button>
        </div>
        <div className="flex items-end gap-2 border-t pt-3">
          <label className="text-xs text-muted-foreground">
            Preço da pré-venda (fora dos lotes)
            <Input inputMode="decimal" placeholder="R$" className="mt-1 h-9 w-[160px]" value={preVenda} onChange={(e) => setPreVenda(e.target.value.replace(/[^\d.,]/g, ""))} />
          </label>
          <Button size="icon" variant="ghost" aria-label="Salvar preço da pré-venda" disabled={!eventId || salvarPreVenda.isPending} onClick={() => salvarPreVenda.mutate()}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
