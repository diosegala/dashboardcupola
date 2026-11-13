import { formatPersonName } from "@/lib/personName";
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
import { UserPlus, Shield, Eye, Loader2, Mail, Trash2, CheckCircle2, Clock, Trophy } from "lucide-react";
import { UserDetailSheet } from "@/components/settings/UserDetailSheet";
import { InviteUserDialog } from "@/components/settings/InviteUserDialog";

interface UserWithAuth {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  email_confirmed_at: string | null;
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

      const authUsers: Array<{ id: string; email: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null }> =
        authRes.data?.users ?? [];
      const authMap = new Map(authUsers.map((u) => [u.id, u]));

      return profilesRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        email: authMap.get(p.id)?.email ?? null,
        created_at: p.created_at,
        role: rolesMap.get(p.id) ?? "viewer",
        email_confirmed_at: authMap.get(p.id)?.email_confirmed_at ?? null,
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
      }));
    },
  });
}

function useManageUser() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { action: string; user_id: string; role?: string }) => {
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

export default function Settings() {
  const { isAdmin, loading: authLoading, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useUsers();
  const [aberto, setAberto] = useState<UserWithAuth | null>(null);
  const [convidando, setConvidando] = useState(false);
  const manageMutation = useManageUser();

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = users?.filter((u) =>
    statusFilter === "all" ? true : statusFilter === "active" ? !!u.email_confirmed_at : !u.email_confirmed_at
  );

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerenciar usuários e permissões" />

      <EventsManager users={users ?? []} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Clique no nome para editar os dados e os cupons da pessoa.</CardDescription>
            </div>
            <Button onClick={() => setConvidando(true)} className="gap-1"><UserPlus className="h-4 w-4" /> Convidar usuário</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Label htmlFor="status-filter" className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="min-w-[13rem]">Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => setAberto(u)}>
                        {u.name ?? "—"}
                      </button>
                      {isSelf(u.id) && (
                        <Badge variant="outline" className="ml-2 text-xs">você</Badge>
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
                          <SelectItem value="viewer">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Visualizador</span>
                          </SelectItem>
                          <SelectItem value="seller">
                            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> Equipe de venda</span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.email_confirmed_at ? (
                        <Badge variant="secondary" className="gap-1 bg-ok-bg text-xs text-ok hover:bg-ok-bg">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-warn-bg text-xs text-warn hover:bg-warn-bg">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
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
                          <TooltipContent>{u.email_confirmed_at ? "Enviar link para redefinir senha" : "Reenviar convite"}</TooltipContent>
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
      <InviteUserDialog open={convidando} onOpenChange={setConvidando} />
      <UserDetailSheet user={aberto} isSelf={!!aberto && isSelf(aberto.id)} onClose={() => setAberto(null)} />
    </div>
  );
}
