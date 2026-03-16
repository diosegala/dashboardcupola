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
import { UserPlus, Shield, Eye, Loader2, Mail, Trash2, CheckCircle2, Clock } from "lucide-react";

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
  const manageMutation = useManageUser();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerenciar usuários e permissões</p>
      </div>

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
            <div className="w-full sm:w-36">
              <Label htmlFor="invite-role" className="sr-only">Função</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
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

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Lista de usuários cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
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
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Viewer</span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
