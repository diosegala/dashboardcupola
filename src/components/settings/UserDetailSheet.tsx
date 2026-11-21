import { PasswordFields, senhaValida } from "@/components/PasswordFields";
import { EmailInput } from "@/components/EmailInput";
import { emailJaUsado, erroEmail, limparEmail } from "@/lib/email";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCouponPeople, COUPON_PEOPLE_KEY } from "@/hooks/useCouponPeople";
import { joinName, splitName } from "@/lib/personName";
import { NameFields } from "./NameFields";
import { Checkbox } from "@/components/ui/checkbox";
import { traduzirErro } from "@/lib/mensagensErro";
import { parseCodes } from "@/lib/couponLink";
import { applyCouponChoice } from "./couponLinking";
import { CouponPicker, typedCodesOk } from "./CouponPicker";
import { Loader2, Mail } from "lucide-react";
import { ROLES, ADMIN_ROLE, NO_ROLE_LABEL } from "@/lib/roles";
import { accessOf, eventAccessActions, refreshEventAccess, useEventAccessMap, type EventAccess } from "@/lib/eventAccess";
import { EventAccessPicker } from "./EventAccessPicker";

export interface SheetUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  email_confirmed_at: string | null;
  active?: boolean;
  team_view?: boolean;
}


export function UserDetailSheet({ user, isSelf, onClose }: { user: SheetUser | null; isSelf: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pessoas = [] } = useCouponPeople();
  const [primeiro, setPrimeiro] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const nome = joinName(primeiro, sobrenome);
  const nomeOk = !!primeiro.trim() && !!sobrenome.trim();
  const [visaoEquipe, setVisaoEquipe] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [pessoaIds, setPessoaIds] = useState<string[]>([]);
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const senhaOk = !senha && !confirmaSenha ? true : senhaValida(senha, confirmaSenha);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const atuaisIds = pessoas.filter((p) => p.userId === user?.id).map((p) => p.id);
  const atuaisKey = atuaisIds.join(",");
  const [typed, setTyped] = useState("");
  const { data: acessos } = useEventAccessMap();
  const acessoAtual = user ? accessOf(acessos?.map, user.id) : null;
  const [acesso, setAcesso] = useState<EventAccess>({ allEvents: false, eventIds: [] });
  useEffect(() => { if (acessoAtual) setAcesso(acessoAtual); }, [user?.id, !!acessos]);

  useEffect(() => {
    if (!user) return;
    const partes = splitName(user.name, user.email);
    setPrimeiro(partes.first);
    setSobrenome(partes.last);
    setVisaoEquipe(!!user.team_view);
    setEmail(user.email ?? "");
    setRole(user.role);
    setSenha("");
    setConfirmaSenha("");
    setTyped("");
  }, [user?.id]);
  useEffect(() => setPessoaIds(atuaisKey ? atuaisKey.split(",") : []), [atuaisKey, user?.id]);

  const contas = queryClient.getQueryData<{ id: string; email: string | null }[]>(["users-with-roles"]);
  const jaUsado = emailJaUsado(email, contas, user?.id);
  const emailValido = !erroEmail(email) && !jaUsado;

  const invocar = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-user", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !emailValido || !nomeOk) return;
    if (!senhaOk) return;
    setSalvando(true);
    try {
      const novoEmail = limparEmail(email);
      await invocar({
        action: "update_user",
        user_id: user.id,
        name: nome || undefined,
        team_view: role === ADMIN_ROLE && visaoEquipe !== !!user.team_view ? visaoEquipe : undefined,
        email: novoEmail !== (user.email ?? "").toLowerCase() ? novoEmail : undefined,
        password: senha || undefined,
      });
      if (!isSelf && role !== user.role) await invocar({ action: "update_role", user_id: user.id, role });
      if (role !== ADMIN_ROLE && JSON.stringify(acesso) !== JSON.stringify(acessoAtual)) {
        await eventAccessActions.save(user.id, acesso);
        refreshEventAccess(queryClient);
      }
      await applyCouponChoice(user.id, nome, { personIds: pessoaIds, typed: parseCodes(typed) }, atuaisIds);
      toast({ title: "Dados atualizados" });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: COUPON_PEOPLE_KEY });
      queryClient.invalidateQueries({ queryKey: ["team_coupons"] });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Não foi possível salvar", description: traduzirErro(err as Error) });
    } finally {
      setSalvando(false);
    }
  };

  const enviarLink = async () => {
    if (!user) return;
    setEnviando(true);
    try {
      const d = await invocar({ action: "resend_invite", user_id: user.id });
      toast({ title: d?.sent === "reset" ? "Link de redefinição de senha enviado" : "Convite reenviado" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: traduzirErro(err as Error) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Altere os dados, a função, os eventos e o cupom de {user?.name ?? "esta pessoa"}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1">
            <NameFields id="ud" first={primeiro} last={sobrenome} onFirst={setPrimeiro} onLast={setSobrenome} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ud-email">E-mail</Label>
            <EmailInput id="ud-email" value={email} onChange={setEmail} extraError={jaUsado} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ud-role">Função</Label>
            <Select value={role} onValueChange={setRole} disabled={isSelf}>
              <SelectTrigger id="ud-role"><SelectValue placeholder={NO_ROLE_LABEL} /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {role === ADMIN_ROLE && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox checked={visaoEquipe} onCheckedChange={(v) => setVisaoEquipe(!!v)} className="mt-0.5" />
              <span>Usa "Ver como a equipe" no menu<span className="block text-xs text-muted-foreground">Desmarcado, o menu mostra "Ver meu ranking".</span></span>
            </label>
          )}
          <EventAccessPicker id="ud-eventos" role={role} value={acesso} onChange={setAcesso} />
          <CouponPicker id="ud-cupom" account={{ name: nome, email }} people={pessoas} userId={user?.id} personIds={pessoaIds} typed={typed}
            onPeople={setPessoaIds} onTyped={setTyped} />
          <PasswordFields id="ud" rotulo="Nova senha (opcional)" senha={senha} confirmacao={confirmaSenha} onSenha={setSenha} onConfirmacao={setConfirmaSenha} />
          <Button type="button" variant="outline" size="sm" onClick={enviarLink} disabled={enviando} className="gap-1">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {user?.active ? "Enviar link de troca de senha" : "Reenviar convite"}
          </Button>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvando || !emailValido || !nomeOk || !senhaOk || !typedCodesOk(typed, pessoas, atuaisIds)}>{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
