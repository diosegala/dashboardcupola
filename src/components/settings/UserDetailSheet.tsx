import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCouponPeople, COUPON_PEOPLE_KEY } from "@/hooks/useCouponPeople";
import { formatPersonName } from "@/lib/personName";
import { traduzirErro } from "@/lib/mensagensErro";
import { parseCodes } from "@/lib/couponLink";
import { applyCouponChoice } from "./couponLinking";
import { CouponPicker, typedCodesOk } from "./CouponPicker";
import { Loader2, Mail } from "lucide-react";

export interface SheetUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  email_confirmed_at: string | null;
}

const SEM = "__sem__";

export function UserDetailSheet({ user, isSelf, onClose }: { user: SheetUser | null; isSelf: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pessoas = [] } = useCouponPeople();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [pessoa, setPessoa] = useState(SEM);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const atual = pessoas.find((p) => p.userId === user?.id);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!user) return;
    setNome(user.name ?? "");
    setEmail(user.email ?? "");
    setRole(user.role);
    setSenha("");
    setTyped("");
  }, [user?.id]);
  useEffect(() => setPessoa(atual?.id ?? SEM), [atual?.id, user?.id]);

  const emailValido = /^[^@\s]+@cupola\.com\.br$/.test(email.trim().toLowerCase());

  const invocar = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-user", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !emailValido) return;
    if (senha && senha.length < 8) return toast({ variant: "destructive", title: "A senha precisa ter pelo menos 8 caracteres" });
    setSalvando(true);
    try {
      const novoEmail = email.trim().toLowerCase();
      await invocar({
        action: "update_user",
        user_id: user.id,
        name: formatPersonName(nome) || undefined,
        email: novoEmail !== (user.email ?? "").toLowerCase() ? novoEmail : undefined,
        password: senha || undefined,
      });
      if (!isSelf && role !== user.role) await invocar({ action: "update_role", user_id: user.id, role });
      await applyCouponChoice(user.id, formatPersonName(nome), { personId: pessoa === SEM ? null : pessoa, typed: parseCodes(typed) }, atual?.id ?? null);
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
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{user?.name ?? "Pessoa"}</SheetTitle>
          <SheetDescription>Altere os dados, a função e o cupom desta pessoa.</SheetDescription>
        </SheetHeader>
        <form onSubmit={salvar} className="mt-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ud-nome">Nome completo</Label>
            <Input id="ud-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ud-email">E-mail</Label>
            <Input id="ud-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {!emailValido && <p className="text-xs text-destructive">O e-mail deve terminar com @cupola.com.br</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ud-role">Função</Label>
            <Select value={role} onValueChange={setRole} disabled={isSelf}>
              <SelectTrigger id="ud-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="seller">Equipe de venda</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CouponPicker id="ud-cupom" account={{ name: nome, email }} people={pessoas} userId={user?.id} personId={pessoa === SEM ? null : pessoa} typed={typed}
            onPerson={(v) => setPessoa(v ?? SEM)} onTyped={setTyped} />
          <div className="space-y-1">
            <Label htmlFor="ud-senha">Nova senha (opcional)</Label>
            <Input id="ud-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={salvando || !emailValido || !typedCodesOk(typed, pessoas, atual?.id)}>{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            <Button type="button" variant="outline" onClick={enviarLink} disabled={enviando} className="gap-1">
              <Mail className="h-4 w-4" />
              {user?.email_confirmed_at ? "Enviar link de troca de senha" : "Reenviar convite"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
