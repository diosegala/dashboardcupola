import { registrarAtividade } from "@/lib/registrarAtividade";
import { PasswordFields, senhaValida } from "@/components/PasswordFields";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { roleInfo } from "@/lib/roles";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [trocandoSenha, setTrocandoSenha] = useState(false);

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
    if (!senhaValida(senha, confirma)) return;
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvandoSenha(false);
    if (error) return toast({ variant: "destructive", title: "Não foi possível trocar a senha", description: traduzirErro(error) });
    void registrarAtividade("acesso.senha_trocada");
    setSenha("");
    setConfirma("");
    setTrocandoSenha(false);
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
          <CardTitle>Eventos que você acompanha</CardTitle>
          <CardDescription>
            {todosEventos
              ? "Seu acesso vale para todos os eventos do painel, inclusive os que ainda vão ser criados."
              : "São os eventos que aparecem para você no painel. Se precisar acompanhar outro, é só pedir acesso ao administrador."}
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
            <p className="text-sm text-muted-foreground">Nenhum evento liberado para você ainda. Peça acesso ao administrador.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Seus cupons</CardTitle>
          <CardDescription>Códigos ligados a você. As vendas feitas com eles contam para você no ranking, em qualquer evento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {meusCupons.data?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {meusCupons.data.map((c) => <Badge key={c} variant="secondary" className="font-mono">{c}</Badge>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{meusCupons.isLoading ? "Carregando…" : "Nenhum cupom ligado a você ainda."}</p>
          )}
          <p className="text-xs text-muted-foreground">Falta algum ou tem um que não é seu? Avise o administrador.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Senha</CardTitle>
            <CardDescription>A senha que você usa para entrar no painel.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setTrocandoSenha(true)}>Trocar senha</Button>
        </CardHeader>
      </Card>
      <Dialog open={trocandoSenha} onOpenChange={(o) => { setTrocandoSenha(o); if (!o) { setSenha(""); setConfirma(""); } }}>
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarSenha} className="space-y-4">
            <PasswordFields id="perfil" senha={senha} confirmacao={confirma} onSenha={setSenha} onConfirmacao={setConfirma} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTrocandoSenha(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoSenha || !senhaValida(senha, confirma)}>{salvandoSenha ? "Salvando…" : "Salvar senha"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
