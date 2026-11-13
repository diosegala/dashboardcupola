import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatPersonName, nameFromEmail } from "@/lib/personName";
import { traduzirErro } from "@/lib/mensagensErro";

const PAPEL: Record<string, string> = { admin: "Admin", viewer: "Visualizador", seller: "Equipe de venda" };

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    const atual = profile?.name && !profile.name.includes("@") ? profile.name : nameFromEmail(profile?.name || user?.email);
    setNome(formatPersonName(atual));
  }, [profile?.name, user?.email]);

  const salvarNome = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatado = formatPersonName(nome);
    if (!user || !formatado) return;
    setSalvandoNome(true);
    const { error } = await supabase.from("profiles").update({ name: formatado }).eq("id", user.id);
    setSalvandoNome(false);
    if (error) return toast({ variant: "destructive", title: "Não foi possível salvar", description: traduzirErro(error) });
    await refreshProfile();
    queryClient.invalidateQueries();
    toast({ title: "Nome atualizado" });
  };

  const salvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return toast({ variant: "destructive", title: "A senha precisa ter pelo menos 8 caracteres" });
    if (senha !== confirma) return toast({ variant: "destructive", title: "As senhas não são iguais" });
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvandoSenha(false);
    if (error) return toast({ variant: "destructive", title: "Não foi possível trocar a senha", description: traduzirErro(error) });
    setSenha("");
    setConfirma("");
    toast({ title: "Senha alterada" });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Meu perfil" description={user?.email ?? ""} />
      <Card>
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>Papel de acesso: <b className="text-foreground">{role ? PAPEL[role] : "—"}</b></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarNome} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="perfil-nome">Nome completo</Label>
              <Input id="perfil-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
            </div>
            <Button type="submit" disabled={salvandoNome}>{salvandoNome ? "Salvando…" : "Salvar"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>Mínimo de 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarSenha} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="perfil-senha">Nova senha</Label>
              <Input id="perfil-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perfil-confirma">Confirme a nova senha</Label>
              <Input id="perfil-confirma" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
            </div>
            <Button type="submit" disabled={salvandoSenha}>{salvandoSenha ? "Salvando…" : "Trocar senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
