import { traduzirErro } from "@/lib/mensagensErro";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COUPON_PEOPLE_KEY, useCouponPeople, type CouponPersonRow } from "@/hooks/useCouponPeople";
import { normalizeCode } from "@/lib/coupons";

interface Form {
  id?: string;
  name: string;
  codes: string;
  sellerNames: string;
  outsideRanking: boolean;
}

const VAZIO: Form = { name: "", codes: "", sellerNames: "", outsideRanking: false };
const lista = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

// Cupons da mesma pessoa e quem fica fora do ranking da equipe, sem precisar mexer no código.
export function CouponPeopleManager() {
  const { data, isLoading } = useCouponPeople();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const linha = {
        name: f.name.trim(),
        codes: [...new Set(lista(f.codes).map(normalizeCode))],
        seller_names: lista(f.sellerNames),
        outside_ranking: f.outsideRanking,
      };
      const { error } = f.id
        ? await supabase.from("coupon_people").update(linha).eq("id", f.id)
        : await supabase.from("coupon_people").insert(linha);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro salvo. O ranking e a lista de cupons já usam a nova regra.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: COUPON_PEOPLE_KEY });
    },
    onError: (e: Error) => toast.error(traduzirErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupon_people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro excluído.");
      queryClient.invalidateQueries({ queryKey: COUPON_PEOPLE_KEY });
    },
    onError: (e: Error) => toast.error(traduzirErro(e)),
  });

  const editar = (p: CouponPersonRow) =>
    setForm({ id: p.id, name: p.name, codes: p.codes.join(", "), sellerNames: p.sellerNames.join(", "), outsideRanking: p.outsideRanking });

  const valido = !!form && form.name.trim() && (lista(form.codes).length > 0 || lista(form.sellerNames).length > 0);
  const pessoas = data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cupons e vendedores
          </CardTitle>
          <CardDescription>
            Junte os cupons da mesma pessoa e escolha quem fica fora do ranking da equipe. Vale para o ranking e para a página Cupons.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setForm(VAZIO)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar pessoa
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && pessoas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : pessoas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Cupons</TableHead>
                  <TableHead>Nome no Pipedrive</TableHead>
                  <TableHead>Ranking da equipe</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pessoas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.codes.length ? p.codes.map((c, i) => (
                          <Badge key={c} variant={i === 0 ? "default" : "secondary"} className="font-mono text-[11px]">{c}</Badge>
                        )) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.sellerNames.join(", ") || "—"}</TableCell>
                    <TableCell>
                      {p.outsideRanking ? <Badge variant="outline">Fora do ranking</Badge> : <span className="text-sm text-muted-foreground">Participa</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${p.name}`} onClick={() => editar(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Excluir ${p.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir {p.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Os cupons voltam a contar separados e, se a pessoa estava fora do ranking, ela volta a aparecer nele.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => excluir.mutate(p.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar pessoa" : "Adicionar pessoa"}</DialogTitle>
            <DialogDescription>Separe os cupons e os nomes por vírgula.</DialogDescription>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (valido) salvar.mutate(form);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="cp-nome">Nome da pessoa</Label>
                <Input id="cp-nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Letícia Bello" required />
                <p className="text-xs text-muted-foreground">O primeiro nome aparece no ranking.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-cupons">Cupons</Label>
                <Input id="cp-cupons" value={form.codes} onChange={(e) => setForm({ ...form, codes: e.target.value })} placeholder="LETICIAC5, LETICIA10" />
                <p className="text-xs text-muted-foreground">O primeiro é o principal. Todos contam como um só cupom.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-vendedor">Nome no Pipedrive (vendas faturadas)</Label>
                <Input id="cp-vendedor" value={form.sellerNames} onChange={(e) => setForm({ ...form, sellerNames: e.target.value })} placeholder="Leticia Bello, Leticia Pinguelli" />
                <p className="text-xs text-muted-foreground">Como a pessoa aparece em "ID do canal de origem". Acentos e maiúsculas não importam.</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="cp-fora">Fora do ranking da equipe</Label>
                  <p className="text-xs text-muted-foreground">As vendas dela não pontuam no ranking. Os cupons seguem na lista de Cupons, em Parceiros e outros.</p>
                </div>
                <Switch id="cp-fora" checked={form.outsideRanking} onCheckedChange={(v) => setForm({ ...form, outsideRanking: v })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" disabled={!valido || salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
