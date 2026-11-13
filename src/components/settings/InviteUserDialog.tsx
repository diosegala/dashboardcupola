import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCouponPeople, COUPON_PEOPLE_KEY } from "@/hooks/useCouponPeople";
import { formatPersonName } from "@/lib/personName";
import { traduzirErro } from "@/lib/mensagensErro";
import { parseCodes } from "@/lib/couponLink";
import { CouponPicker, typedCodesOk } from "./CouponPicker";
import { applyCouponChoice } from "./couponLinking";
import { Loader2 } from "lucide-react";

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pessoas = [] } = useCouponPeople();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [personId, setPersonId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [enviando, setEnviando] = useState(false);

  const emailLimpo = email.trim().toLowerCase();
  const emailValido = /^[^@\s]+@cupola\.com\.br$/.test(emailLimpo);
  const codigosOk = typedCodesOk(typed, pessoas);

  const limpar = () => { setNome(""); setEmail(""); setRole("viewer"); setPersonId(null); setTyped(""); };

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValido || !nome.trim() || !codigosOk) return;
    setEnviando(true);
    try {
      const nomeFmt = formatPersonName(nome);
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { email: emailLimpo, role, name: nomeFmt } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.user_id && (personId || typed)) {
        try { await applyCouponChoice(data.user_id, nomeFmt, { personId, typed: parseCodes(typed) }); }
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
          <DialogDescription>Só e-mails @cupola.com.br. A pessoa recebe um link para criar a senha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={convidar} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="iv-nome">Nome completo</Label>
            <Input id="iv-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-email">E-mail</Label>
            <Input id="iv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@cupola.com.br" maxLength={255} required />
            {email.length > 0 && !emailValido && <p className="text-xs text-destructive">O e-mail deve terminar com @cupola.com.br</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-role">Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="iv-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="seller">Equipe de venda</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CouponPicker id="iv-cupom" account={{ name: nome, email: emailLimpo }} people={pessoas} personId={personId} typed={typed} onPerson={setPersonId} onTyped={setTyped} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !emailValido || !nome.trim() || !codigosOk}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
