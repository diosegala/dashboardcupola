import { useState } from "react";
import { EmailInput } from "@/components/EmailInput";
import { erroEmail, limparEmail } from "@/lib/email";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCouponPeople, COUPON_PEOPLE_KEY } from "@/hooks/useCouponPeople";
import { joinName } from "@/lib/personName";
import { NameFields } from "./NameFields";
import { traduzirErro } from "@/lib/mensagensErro";
import { parseCodes } from "@/lib/couponLink";
import { CouponPicker, typedCodesOk } from "./CouponPicker";
import { applyCouponChoice } from "./couponLinking";
import { Loader2 } from "lucide-react";
import { ROLES, DEFAULT_ROLE, ADMIN_ROLE } from "@/lib/roles";
import { eventAccessActions, refreshEventAccess, type EventAccess } from "@/lib/eventAccess";
import { EventAccessPicker } from "./EventAccessPicker";

const SEM_ACESSO: EventAccess = { allEvents: false, eventIds: [] };

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pessoas = [] } = useCouponPeople();
  const [primeiro, setPrimeiro] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const nome = joinName(primeiro, sobrenome);
  const nomeOk = !!primeiro.trim() && !!sobrenome.trim();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [acesso, setAcesso] = useState<EventAccess>(SEM_ACESSO);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [enviando, setEnviando] = useState(false);

  const emailLimpo = limparEmail(email);
  const emailValido = !erroEmail(email);
  const codigosOk = typedCodesOk(typed, pessoas);

  const limpar = () => { setPrimeiro(""); setSobrenome(""); setEmail(""); setRole(DEFAULT_ROLE); setAcesso(SEM_ACESSO); setPersonIds([]); setTyped(""); };

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValido || !nomeOk || !codigosOk) return;
    setEnviando(true);
    try {
      const nomeFmt = nome;
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { email: emailLimpo, role, name: nomeFmt } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.user_id && role !== ADMIN_ROLE) {
        try { await eventAccessActions.save(data.user_id, acesso); }
        catch (err) { toast({ variant: "destructive", title: "Convite enviado, mas o acesso aos eventos não foi salvo", description: traduzirErro(err as Error) }); }
        refreshEventAccess(queryClient);
      }
      if (data?.user_id && (personIds.length || typed)) {
        try { await applyCouponChoice(data.user_id, nomeFmt, { personIds, typed: parseCodes(typed) }); }
        catch (err) { toast({ variant: "destructive", title: "Convite enviado, mas o cupom não foi ligado", description: traduzirErro(err as Error) }); }
      }
      toast({ title: "Convite enviado", description: `Convite enviado para ${emailLimpo}` });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: COUPON_PEOPLE_KEY });
      limpar();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao convidar", description: traduzirErro(err as Error) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>Pode ser de qualquer domínio. A pessoa recebe um link por e-mail para criar a senha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={convidar} className="space-y-4">
          <div className="space-y-1">
            <NameFields id="iv" first={primeiro} last={sobrenome} onFirst={setPrimeiro} onLast={setSobrenome} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-email">E-mail</Label>
            <EmailInput id="iv-email" value={email} onChange={setEmail} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-role">Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="iv-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <EventAccessPicker id="iv-eventos" role={role} value={acesso} onChange={setAcesso} />
          <CouponPicker id="iv-cupom" account={{ name: nome, email: emailLimpo }} people={pessoas} personIds={personIds} typed={typed} onPeople={setPersonIds} onTyped={setTyped} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !emailValido || !nomeOk || !codigosOk}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
