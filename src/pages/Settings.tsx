import { formatPersonName, lacksSurname } from "@/lib/personName";
import { traduzirErro } from "@/lib/mensagensErro";
import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { EventsManager } from "@/components/settings/EventsManager";
import { UserPlus, Loader2, ArrowUp, ArrowDown, Mail, Trash2, CheckCircle2, Clock, Ban, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEvent } from "@/hooks/useEvent";
import { ROLES, ADMIN_ROLE, DEFAULT_ROLE, roleInfo, roleRank } from "@/lib/roles";
import { accessOf, eventAccessActions, refreshEventAccess, useEventAccessMap } from "@/lib/eventAccess";
import { UserDetailSheet } from "@/components/settings/UserDetailSheet";
import { InviteUserDialog } from "@/components/settings/InviteUserDialog";

interface UserWithAuth {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  email_confirmed_at: string | null;
  active: boolean;
  disabled: boolean;
  invited_by: string | null;
  team_view: boolean;
  last_sign_in_at: string | null;
}

function useUsers() {
  return useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async (): Promise<UserWithAuth[]> => {
      const [profilesRes, rolesRes, authRes] = await Promise.all([
        supabase.from("profiles").select("id, name, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.functions.invoke("manage-user", { body: { action: "list_users" } }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (authRes.error) throw new Error(authRes.error.message);
      if (authRes.data?.error) throw new Error(authRes.data.error);

      const rolesMap = new Map<string, string>();
      for (const r of rolesRes.data) {
        rolesMap.set(r.user_id, r.role);
      }

      const authUsers: Array<{ id: string; email: string | null; email_confirmed_at: string | null; active?: boolean; disabled?: boolean; created_at?: string; invited_by?: string | null; team_view?: boolean; last_sign_in_at: string | null }> =
        authRes.data?.users ?? [];
      const authMap = new Map(authUsers.map((u) => [u.id, u]));

      return profilesRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        email: authMap.get(p.id)?.email ?? null,
        created_at: authMap.get(p.id)?.created_at ?? p.created_at,
        role: rolesMap.get(p.id) ?? DEFAULT_ROLE,
        email_confirmed_at: authMap.get(p.id)?.email_confirmed_at ?? null,
        active: !!authMap.get(p.id)?.active,
        disabled: !!authMap.get(p.id)?.disabled,
        invited_by: authMap.get(p.id)?.invited_by ?? null,
        team_view: !!authMap.get(p.id)?.team_view,
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
      }));
    },
  });
}

function useManageUser() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { action: string; user_id: string; role?: string; active?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-user", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.action === "resend_invite" && (data as any)?.sent === "reset") {
        toast({ title: "Link de redefinição de senha enviado" });
        return;
      }
      const messages: Record<string, string> = {
        update_role: "Função atualizada com sucesso",
        set_active: "Status atualizado",
        resend_invite: "Convite reenviado com sucesso",
        delete_user: "Usuário excluído com sucesso",
      };
      toast({ title: messages[variables.action] ?? "Sucesso" });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: traduzirErro(err) });
    },
  });
}


type Status = "active" | "pending" | "disabled";
const STATUS_RANK: Record<Status, number> = { active: 0, pending: 1, disabled: 2 };

// Ordenação pelos títulos das colunas. Padrão: função (admin primeiro) e, dentro dela, nome.
type SortKey = "name" | "role" | "status" | "last_sign_in_at" | "created_at";
const porNome = (a: UserWithAuth, b: UserWithAuth) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "", "pt-BR", { sensitivity: "base" });
const ORDENS: Record<SortKey, (a: UserWithAuth, b: UserWithAuth) => number> = {
  name: porNome,
  role: (a, b) => roleRank(a.role) - roleRank(b.role),
  status: (a, b) => STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)],
  // Mais recente primeiro; quem nunca entrou vai para o fim.
  last_sign_in_at: (a, b) => (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? ""),
  created_at: (a, b) => b.created_at.localeCompare(a.created_at),
};
const statusOf = (u: UserWithAuth): Status => (u.disabled ? "disabled" : u.active ? "active" : "pending");

// Ações em lote. As de evento só valem para quem não é admin (admin vê todos pelo papel).
type BulkAction =
  | { kind: "set_active"; active: boolean }
  | { kind: "role"; role: string }
  | { kind: "all_events" }
  | { kind: "only_specific" }
  | { kind: "grant" | "revoke"; eventId: string; eventName: string };

function bulkLabel(a: BulkAction) {
  switch (a.kind) {
    case "set_active": return a.active ? "Ativar" : "Inativar";
    case "role": return `Mudar função para ${roleInfo(a.role).label}`;
    case "all_events": return "Liberar todos os eventos";
    case "only_specific": return "Restringir aos eventos já liberados";
    case "grant": return `Conceder acesso a ${a.eventName}`;
    case "revoke": return `Remover acesso a ${a.eventName}`;
  }
}

export default function Settings() {
  const { isAdmin, loading: authLoading, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: acessos } = useEventAccessMap();
  const { events } = useEvent();
  const eventList = events.filter((e) => e.id);
  const eventName = (id: string) => eventList.find((e) => e.id === id)?.name ?? "evento";
  const [aberto, setAberto] = useState<UserWithAuth | null>(null);
  const [convidando, setConvidando] = useState(false);
  const manageMutation = useManageUser();

  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pendente, setPendente] = useState<BulkAction | null>(null);
  const [executando, setExecutando] = useState(false);

  const isSelf = (userId: string) => currentUser?.id === userId;
  const access = (u: UserWithAuth) => accessOf(acessos?.map, u.id);
  const seesEvent = (u: UserWithAuth, eventId: string) =>
    u.role === ADMIN_ROLE || access(u).allEvents || access(u).eventIds.includes(eventId);

  const termo = busca.trim().toLowerCase();
  const [ordem, setOrdem] = useState<{ key: SortKey; desc: boolean }>({ key: "role", desc: false });
  const ordenar = (key: SortKey) => setOrdem((o) => (o.key === key ? { key, desc: !o.desc } : { key, desc: false }));
  const filteredUsers = (users ?? []).filter((u) =>
    (!termo || (u.name ?? "").toLowerCase().includes(termo) || (u.email ?? "").toLowerCase().includes(termo)) &&
    (statusFilter === "all" || statusOf(u) === statusFilter) &&
    (roleFilter === "all" || u.role === roleFilter) &&
    (eventFilter === "all" || seesEvent(u, eventFilter))
  );
  filteredUsers.sort((a, b) => {
    const c = ORDENS[ordem.key](a, b) * (ordem.desc ? -1 : 1);
    return c || porNome(a, b);
  });
  const visiveisSelecionados = filteredUsers.filter((u) => selecionados.has(u.id));
  const todosMarcados = filteredUsers.length > 0 && visiveisSelecionados.length === filteredUsers.length;

  const alternar = (id: string, on: boolean) =>
    setSelecionados((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const alternarTodos = (on: boolean) => setSelecionados(on ? new Set(filteredUsers.map((u) => u.id)) : new Set());

  // Quem a ação realmente alcança e quem fica de fora (e por quê).
  const alcance = (a: BulkAction) => {
    const alvo = visiveisSelecionados;
    if (a.kind === "set_active" || a.kind === "role") {
      return { aplica: alvo.filter((u) => !isSelf(u.id)), ignorados: alvo.some((u) => isSelf(u.id)) ? "Você mesmo fica de fora." : "" };
    }
    const admins = alvo.filter((u) => u.role === ADMIN_ROLE);
    return {
      aplica: alvo.filter((u) => u.role !== ADMIN_ROLE),
      ignorados: admins.length ? `${admins.length} ${admins.length === 1 ? "é administrador e já vê" : "são administradores e já veem"} todos os eventos.` : "",
    };
  };

  const executar = async (a: BulkAction) => {
    const ids = alcance(a).aplica.map((u) => u.id);
    if (!ids.length) return setPendente(null);
    setExecutando(true);
    try {
      const invocar = async (body: Record<string, unknown>) => {
        const { data, error } = await supabase.functions.invoke("manage-user", { body });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
      };
      if (a.kind === "set_active") await Promise.all(ids.map((user_id) => invocar({ action: "set_active", user_id, active: a.active })));
      else if (a.kind === "role") await Promise.all(ids.map((user_id) => invocar({ action: "update_role", user_id, role: a.role })));
      else if (a.kind === "all_events") await eventAccessActions.allEvents(ids);
      else if (a.kind === "only_specific") await eventAccessActions.onlySpecific(ids);
      else if (a.kind === "grant") await eventAccessActions.grant(ids, a.eventId);
      else await eventAccessActions.revoke(ids, a.eventId);
      toast({ title: `${bulkLabel(a)}: ${ids.length} ${ids.length === 1 ? "usuário" : "usuários"}` });
      setSelecionados(new Set());
    } catch (err) {
      toast({ variant: "destructive", title: "Não foi possível concluir", description: traduzirErro(err as Error) });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      refreshEventAccess(queryClient);
      setExecutando(false);
      setPendente(null);
    }
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const eventosCell = (u: UserWithAuth) => {
    if (u.role === ADMIN_ROLE || access(u).allEvents) return <span className="text-sm text-muted-foreground">Todos</span>;
    const nomes = access(u).eventIds.map(eventName);
    if (!nomes.length) return <Badge variant="secondary" className="bg-warn-bg text-xs text-warn hover:bg-warn-bg">Nenhum</Badge>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default text-sm text-muted-foreground">
            {nomes.length === 1 ? nomes[0] : `${nomes.length} eventos`}
          </span>
        </TooltipTrigger>
        <TooltipContent>{nomes.join(", ")}</TooltipContent>
      </Tooltip>
    );
  };

  // Ao passar o mouse no status: quem criou e quando (vale para todos; antigos sem registro dizem isso).
  const criadoPor = (u: UserWithAuth) => {
    const quando = new Date(u.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const admin = u.invited_by ? users?.find((x) => x.id === u.invited_by) : undefined;
    const quem = admin ? formatPersonName(admin.name ?? "") || admin.email : u.invited_by ? "um usuário já excluído" : null;
    return quem ? `Criado por ${quem} em ${quando}` : `Criado em ${quando} · criador não registrado`;
  };

  const statusBadge = (u: UserWithAuth) => (
    <Tooltip>
      <TooltipTrigger asChild><span className="inline-flex cursor-default">{statusSelo(u)}</span></TooltipTrigger>
      <TooltipContent>{criadoPor(u)}</TooltipContent>
    </Tooltip>
  );

  const statusSelo = (u: UserWithAuth) => {
    const st = statusOf(u);
    if (st === "disabled") return <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground"><Ban className="h-3 w-3" /> Inativo</Badge>;
    if (st === "active") return <Badge variant="secondary" className="gap-1 bg-ok-bg text-xs text-ok hover:bg-ok-bg"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>;
    return <Badge variant="secondary" className="gap-1 bg-warn-bg text-xs text-warn hover:bg-warn-bg"><Clock className="h-3 w-3" /> Pendente</Badge>;
  };

  const resumo = pendente ? alcance(pendente) : null;

  // Status ordena por status ou por data de criação (a data aparece ao passar o mouse no status).
  const statusAtivo = ordem.key === "status" || ordem.key === "created_at";
  const SetaStatus = ordem.desc ? ArrowDown : ArrowUp;
  const cabecalhoStatus = (
    <TableHead aria-sort={statusAtivo ? (ordem.desc ? "descending" : "ascending") : "none"}>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 hover:text-foreground">
          Status{statusAtivo && <SetaStatus className="h-3 w-3" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => ordenar("status")}>Ordenar por status</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => ordenar("created_at")}>Ordenar por data de criação</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  );

  // Título de coluna que ordena ao clicar; a seta só aparece na coluna em uso.
  const cabecalho = (key: SortKey, rotulo: string, className?: string) => {
    const ativa = ordem.key === key;
    const Seta = ordem.desc ? ArrowDown : ArrowUp;
    return (
      <TableHead className={className} aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"}>
        <button type="button" onClick={() => ordenar(key)} className="inline-flex items-center gap-1 hover:text-foreground">
          {rotulo}
          {ativa && <Seta className="h-3 w-3" />}
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerenciar usuários e permissões" />

      <EventsManager users={users ?? []} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Clique no nome para editar os dados, os eventos e os cupons da pessoa.</CardDescription>
            </div>
            <Button onClick={() => setConvidando(true)} className="gap-1"><UserPlus className="h-4 w-4" /> Convidar usuário</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou e-mail" className="h-8 w-full sm:w-56" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-40" aria-label="Filtrar por função"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="disabled">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="h-8 w-48" aria-label="Filtrar por evento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer evento</SelectItem>
                {eventList.map((e) => <SelectItem key={e.id} value={e.id as string}>Vê {e.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {visiveisSelecionados.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="ml-auto h-8 gap-1">
                    {visiveisSelecionados.length} {visiveisSelecionados.length === 1 ? "selecionado" : "selecionados"} <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setPendente({ kind: "set_active", active: true })}>Ativar</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPendente({ kind: "set_active", active: false })}>Inativar</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Mudar função</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {ROLES.map((r) => <DropdownMenuItem key={r.value} onSelect={() => setPendente({ kind: "role", role: r.value })}>{r.label}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setPendente({ kind: "all_events" })}>Liberar todos os eventos</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPendente({ kind: "only_specific" })}>Restringir aos eventos já liberados</DropdownMenuItem>
                  {(["grant", "revoke"] as const).map((kind) => (
                    <DropdownMenuSub key={kind}>
                      <DropdownMenuSubTrigger>{kind === "grant" ? "Conceder acesso a…" : "Remover acesso a…"}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {eventList.map((e) => (
                          <DropdownMenuItem key={e.id} onSelect={() => setPendente({ kind, eventId: e.id as string, eventName: e.name })}>{e.name}</DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={todosMarcados} onCheckedChange={(v) => alternarTodos(!!v)} aria-label="Selecionar todos" />
                  </TableHead>
                  {cabecalho("name", "Nome")}
                  {cabecalho("role", "Função", "min-w-[13rem]")}
                  <TableHead>Eventos</TableHead>
                  {cabecalhoStatus}
                  {cabecalho("last_sign_in_at", "Último login")}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} data-state={selecionados.has(u.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selecionados.has(u.id)} onCheckedChange={(v) => alternar(u.id, !!v)} aria-label={`Selecionar ${u.name ?? "usuário"}`} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => setAberto(u)}>
                        {u.name ?? "—"}
                      </button>
                      {isSelf(u.id) && (
                        <Badge variant="outline" className="ml-2 text-xs">você</Badge>
                      )}
                      {lacksSurname(u.name) && (
                        <Badge variant="secondary" className="ml-2 bg-warn-bg text-xs text-warn hover:bg-warn-bg">falta sobrenome</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        disabled={isSelf(u.id) || manageMutation.isPending}
                        onValueChange={(newRole) =>
                          manageMutation.mutate({ action: "update_role", user_id: u.id, role: newRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-full whitespace-nowrap">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              <span className="flex items-center gap-1"><r.icon className="h-3 w-3" /> {r.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{eventosCell(u)}</TableCell>
                    <TableCell>{statusBadge(u)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={manageMutation.isPending}
                              onClick={() =>
                                manageMutation.mutate({ action: "resend_invite", user_id: u.id })
                              }
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{u.active ? "Enviar link para redefinir senha" : "Reenviar convite"}</TooltipContent>
                        </Tooltip>

                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={isSelf(u.id) || manageMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Excluir usuário</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir <strong>{u.name ?? u.id}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  manageMutation.mutate({ action: "delete_user", user_id: u.id })
                                }
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && !executando && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendente && bulkLabel(pendente)}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {resumo?.aplica.length
                    ? `Vale para ${resumo.aplica.length} ${resumo.aplica.length === 1 ? "usuário" : "usuários"}: ${resumo.aplica.map((u) => u.name ?? "Sem nome").join(", ")}.`
                    : "Nenhum dos selecionados é alcançado por esta ação."}
                </p>
                {resumo?.ignorados && <p>{resumo.ignorados}</p>}
                {pendente?.kind === "only_specific" && (
                  <p className="text-warn">Eles passam a ver só os eventos já liberados para cada um. Quem não tiver nenhum fica sem acesso.</p>
                )}
                {pendente?.kind === "grant" && <p>Quem já vê todos os eventos continua vendo todos.</p>}
                {pendente?.kind === "set_active" && !pendente.active && (
                  <p className="text-warn">A pessoa não consegue mais entrar até ser ativada de novo. Nada é apagado.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={executando || !resumo?.aplica.length}
              onClick={(e) => { e.preventDefault(); if (pendente) executar(pendente); }}
            >
              {executando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteUserDialog open={convidando} onOpenChange={setConvidando} />
      <UserDetailSheet user={aberto} isSelf={!!aberto && isSelf(aberto.id)} onClose={() => setAberto(null)} />
    </div>
  );
}
