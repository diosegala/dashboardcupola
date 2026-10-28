import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { isEventClosed, previousEventOf, useEvent, type EventRow } from "@/hooks/useEvent";

interface UserOption {
  id: string;
  name: string | null;
}

interface EventForm {
  id?: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string;
  sympla_event_id: string;
}

const EMPTY: EventForm = {
  name: "",
  slug: "",
  start_date: "",
  end_date: "",
  sympla_event_id: "",
};

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/cupola\s*/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—");

// Cadastro de eventos e de quem pode ver cada um (só administradores chegam aqui).
export function EventsManager({ users }: { users: UserOption[] }) {
  const { events, hasEventsTable } = useEvent();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EventForm | null>(null);
  const [accessEvent, setAccessEvent] = useState<EventRow | null>(null);

  // Eventos da conta Sympla, buscados no servidor (o token não vem para o navegador).
  const symplaEvents = useQuery({
    queryKey: ["sympla_account_events"],
    enabled: !!form,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-sympla-events");
      if (error || !data?.events) return [] as { id: string; name: string; start_date: string | null; end_date: string | null }[];
      return data.events as { id: string; name: string; start_date: string | null; end_date: string | null }[];
    },
  });

  const access = useQuery({
    queryKey: ["event_users"],
    enabled: hasEventsTable,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_users" as any).select("event_id, user_id");
      if (error) throw error;
      return (data ?? []) as unknown as { event_id: string; user_id: string }[];
    },
  });

  const saveEvent = useMutation({
    mutationFn: async (f: EventForm) => {
      const row = {
        name: f.name.trim(),
        slug: f.slug.trim() || slugify(f.name),
        start_date: f.start_date || null,
        end_date: f.end_date,
        sympla_event_id: f.sympla_event_id.trim() || null,
        // Guardado para o acesso à comparação: é sempre o evento imediatamente anterior.
        previous_event_slug: previousEventOf({ slug: f.slug, end_date: f.end_date }, events)?.slug ?? null,
      };
      let eventId = f.id;
      if (f.id) {
        const { error } = await supabase.from("events" as any).update(row).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events" as any).insert(row).select("id").single();
        if (error) throw error;
        eventId = (data as any).id;
        // Todo evento novo nasce com o grupo padrão de integrações.
        const { data: catalog } = await supabase.rpc("get_integrations_status");
        const names = (catalog ?? []).map((i: any) => i.name);
        if (names.length) {
          await supabase.from("event_integrations" as any).insert(names.map((n: string) => ({ event_id: eventId, integration_name: n })));
        }
      }
    },
    onSuccess: () => {
      toast.success("Evento salvo");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) => toast.error("Erro ao salvar evento: " + err.message),
  });

  const toggleAccess = useMutation({
    mutationFn: async ({ eventId, userId, allow }: { eventId: string; userId: string; allow: boolean }) => {
      const table = supabase.from("event_users" as any);
      const { error } = allow
        ? await table.insert({ event_id: eventId, user_id: userId })
        : await table.delete().eq("event_id", eventId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event_users"] }),
    onError: (err: any) => toast.error("Erro ao alterar acesso: " + err.message),
  });

  if (!hasEventsTable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>Disponível depois que o SQL da fase 8 for rodado no Lovable.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allowed = (eventId: string) => new Set((access.data ?? []).filter((a) => a.event_id === eventId).map((a) => a.user_id));
  const set = (patch: Partial<EventForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>Cada evento tem as suas datas, ID da Sympla e quem pode ver. As metas ficam na tela Metas.</CardDescription>
        </div>
        <Button onClick={() => setForm({ ...EMPTY })}>
          <CalendarPlus className="h-4 w-4" />
          Novo evento
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Datas</TableHead>
              <TableHead>Compara com</TableHead>
              <TableHead className="text-right">Acessos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.slug}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {e.name}
                    {isEventClosed(e) && <Chip variant="neutral">Encerrado</Chip>}
                    {!e.sympla_event_id && <Chip variant="warn">Sem ID da Sympla</Chip>}
                  </span>
                </TableCell>
                <TableCell>
                  {fmtDate(e.start_date)} a {fmtDate(e.end_date)}
                </TableCell>
                <TableCell>{events.find((p) => p.slug === e.previous_event_slug)?.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setAccessEvent(e)}>
                    <Users className="h-4 w-4" />
                    {e.id ? allowed(e.id).size : 0}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar evento"
                    onClick={() =>
                      setForm({
                        id: e.id ?? undefined,
                        name: e.name,
                        slug: e.slug,
                        start_date: e.start_date ?? "",
                        end_date: e.end_date,
                        sympla_event_id: e.sympla_event_id ?? "",
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-lg rounded-[24px]">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="grid gap-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                saveEvent.mutate(form);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ev-name">Nome</Label>
                <Input id="ev-name" required value={form.name} placeholder="CUPOLA Summit 2028" onChange={(e) => set({ name: e.target.value, ...(form.id ? {} : { slug: slugify(e.target.value) }) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-start">Abertura</Label>
                  <Input id="ev-start" type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-end">Último dia</Label>
                  <Input id="ev-end" type="date" required value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-sympla">Evento na Sympla</Label>
                  {symplaEvents.data?.length ? (
                    <Select
                      value={form.sympla_event_id || undefined}
                      onValueChange={(id) => {
                        const se = symplaEvents.data?.find((e) => e.id === id);
                        set({
                          sympla_event_id: id,
                          // Preenche nome e datas só se ainda estiverem vazios.
                          ...(se && !form.name ? { name: se.name, slug: slugify(se.name) } : {}),
                          ...(se?.start_date && !form.start_date ? { start_date: se.start_date.slice(0, 10) } : {}),
                          ...(se?.end_date && !form.end_date ? { end_date: se.end_date.slice(0, 10) } : {}),
                        });
                      }}
                    >
                      <SelectTrigger id="ev-sympla">
                        <SelectValue placeholder="Escolha o evento da conta Sympla" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[320px]">
                        {symplaEvents.data.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} · {fmtDate(e.start_date?.slice(0, 10) ?? null)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    // Sem a lista (carregando ou função fora do ar), dá para informar o ID direto.
                    <Input
                      id="ev-sympla"
                      value={form.sympla_event_id}
                      placeholder={symplaEvents.isLoading ? "Carregando eventos da Sympla…" : "ID do evento na Sympla"}
                      onChange={(e) => set({ sympla_event_id: e.target.value })}
                    />
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveEvent.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessEvent} onOpenChange={(open) => !open && setAccessEvent(null)}>
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Quem vê {accessEvent?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Administradores veem todos os eventos. Marque quem mais pode ver este.</p>
          <div className="max-h-[360px] space-y-1 overflow-auto">
            {accessEvent?.id &&
              users.map((u) => {
                const checked = allowed(accessEvent.id as string).has(u.id);
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-secondary">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleAccess.mutate({ eventId: accessEvent.id as string, userId: u.id, allow: !!v })}
                    />
                    {u.name || "Sem nome"}
                  </label>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
