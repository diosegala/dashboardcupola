import { PasswordInput } from "@/components/ui/password-input";
import { roleInfo } from "@/lib/roles";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { joinName, splitName } from "@/lib/personName";
import { NameFields } from "@/components/settings/NameFields";
import { useEvent } from "@/hooks/useEvent";
import { accessOf, useEventAccessMap } from "@/lib/eventAccess";
import { CalendarDays } from "lucide-react";
import { traduzirErro } from "@/lib/mensagensErro";
import { useMyTeamCoupons } from "@/hooks/useTeam";
import { Badge } from "@/components/ui/badge";


// Período do evento: "19 a 21/05/2027" (ou só a data final, sem início cadastrado).
function datas(inicio: string | null, fim: string) {
  const d = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");
  return inicio ? `${d(inicio).slice(0, 2)} a ${d(fim)}` : d(fim);
}

export default function Profile() {
  const { user, profile, role, refreshProfile, isAdmin } = useAuth();
  // A lista de eventos já vem filtrada pelo banco: são exatamente os liberados para a pessoa.
  const { events } = useEvent();
  const liberados = events.filter((e) => e.id);
  const { data: acessos } = useEventAccessMap();
  const todosEventos = isAdmin || (!!user && accessOf(acessos?.map, user.id).allEvents);
  const queryClient = useQueryClient();
  const meusCupons = useMyTeamCoupons();
  const [primeiro, setPrimeiro] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    const partes = splitName(profile?.name, user?.email);
    setPrimeiro(partes.first);
    setSobrenome(partes.last);
  }, [profile?.name, user?.email]);

  const salvarNome = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatado = joinName(primeiro, sobrenome);
    if (!user || !primeiro.trim() || !sobrenome.trim()) return;
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
          <CardDescription>Papel de acesso: <b className="text-foreground">{role ? roleInfo(role).label : "—"}</b></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarNome} className="space-y-3">
            <NameFields id="perfil" first={primeiro} last={sobrenome} onFirst={setPrimeiro} onLast={setSobrenome} />
            <Button type="submit" disabled={salvandoNome || !primeiro.trim() || !sobrenome.trim()}>{salvandoNome ? "Salvando…" : "Salvar"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Seus eventos</CardTitle>
          <CardDescription>
            {todosEventos ? "Você vê todos os eventos, inclusive os próximos." : "Você vê apenas os eventos abaixo. Precisa de outro? Fale com o administrador."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {liberados.length ? (
            <div className="flex flex-wrap gap-2">
              {liberados.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1.5 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {e.name}
                  <span className="text-xs text-muted-foreground">{datas(e.start_date, e.end_date)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento liberado ainda. Fale com o administrador.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Seus cupons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {meusCupons.data?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {meusCupons.data.map((c) => <Badge key={c} variant="secondary" className="font-mono">{c}</Badge>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{meusCupons.isLoading ? "Carregando…" : "Nenhum cupom ligado à sua conta ainda."}</p>
          )}
          <p className="text-xs text-muted-foreground">Algo não bate? Fale com o administrador.</p>
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
              <PasswordInput id="perfil-senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perfil-confirma">Confirme a nova senha</Label>
              <PasswordInput id="perfil-confirma" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
            </div>
            <Button type="submit" disabled={salvandoSenha}>{salvandoSenha ? "Salvando…" : "Trocar senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
