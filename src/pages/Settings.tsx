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
import { useTeamCoupons } from "@/hooks/useTeam";

interface UserWithAuth {
  id: string;
  name: string | null;
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

      const authUsers: Array<{ id: string; email_confirmed_at: string | null; last_sign_in_at: string | null }> =
        authRes.data?.users ?? [];
      const authMap = new Map(authUsers.map((u) => [u.id, u]));

      return profilesRes.data.map((p) => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at,
        role: rolesMap.get(p.id) ?? "viewer",
        email_confirmed_at: authMap.get(p.id)?.email_confirmed_at ?? null,
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
      }));
    },
  });
}

// Cupons da pessoa da equipe, separados por vírgula. Salva ao sair do campo.
function TeamCouponInput({ userId, codes }: { userId: string; codes: string[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const atual = codes.join(", ");
  const [valor, setValor] = useState(atual);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const novos = Array.from(new Set(valor.split(/[,\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)));
    if (novos.join(", ") === atual) return;
    setSalvando(true);
    const tabela = supabase.from("team_coupons" as any);
    const apagar = await tabela.delete().eq("user_id", userId);
    const inserir = apagar.error || novos.length === 0 ? apagar : await supabase.from("team_coupons" as any).insert(novos.map((coupon_code) => ({ user_id: userId, coupon_code })));
    setSalvando(false);
    if (inserir.error) {
      toast({ variant: "destructive", title: "Não deu para salvar o cupom", description: inserir.error.message });
      setValor(atual);
      return;
    }
    setValor(novos.join(", "));
    toast({ title: novos.length ? "Cupom salvo" : "Cupom removido" });
    queryClient.invalidateQueries({ queryKey: ["team_coupons"] });
  };

  return (
    <Input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      disabled={salvando}
      placeholder="Cupom (ex.: NOME5)"
      className="mt-1.5 h-8 w-40 font-mono text-xs uppercase"
      title="Cupom desta pessoa da equipe. Mais de um? Separe por vírgula."
    />
  );
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
    onSuccess: (_, variables) => {
      const messages: Record<string, string> = {
        update_role: "Função atualizada com sucesso",
        resend_invite: "Convite reenviado com sucesso",
        delete_user: "Usuário excluído com sucesso",
      };
      toast({ title: messages[variables.action] ?? "Sucesso" });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    },
  });
}

export default function Settings() {
  const { isAdmin, loading: authLoading, user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useUsers();
  const teamCoupons = useTeamCoupons(isAdmin);
  const manageMutation = useManageUser();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = users?.filter((u) =>
    statusFilter === "all" ? true : statusFilter === "active" ? !!u.email_confirmed_at : !u.email_confirmed_at
  );

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email, role },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Convite enviado", description: `Convite enviado para ${email}` });
      setEmail("");
      setRole("viewer");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao convidar", description: err.message });
    },
  });

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const isValidEmail = email.trim().toLowerCase().endsWith("@cupola.com.br");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail) return;
    inviteMutation.mutate({ email: email.trim().toLowerCase(), role });
  };

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Gerenciar usuários e permissões" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar usuário
          </CardTitle>
          <CardDescription>
            Apenas e-mails com domínio <strong>@cupola.com.br</strong> são aceitos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="nome@cupola.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {email.length > 0 && !isValidEmail && (
                <p className="text-xs text-destructive">O e-mail deve terminar com @cupola.com.br</p>
              )}
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="invite-role" className="sr-only">Função</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="seller">Equipe de vendas</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!isValidEmail || inviteMutation.isPending}>
              {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <EventsManager users={users ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Lista de usuários cadastrados no sistema</CardDescription>
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
                  <TableHead>Função</TableHead>
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
                      {u.name ?? "—"}
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
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Viewer</span>
                          </SelectItem>
                          <SelectItem value="seller">
                            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> Equipe de vendas</span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {u.role === "seller" && (
                        <TeamCouponInput key={(teamCoupons.data?.[u.id] ?? []).join(",")} userId={u.id} codes={teamCoupons.data?.[u.id] ?? []} />
                      )}
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
                          <TooltipContent>Reenviar convite</TooltipContent>
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
    </div>
  );
}
