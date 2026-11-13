import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CouponPersonRow } from "@/hooks/useCouponPeople";
import { cleanCodeInput, parseCodes, suggestCouponPeople, uniqueCodes } from "@/lib/couponLink";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Props {
  id: string;
  account: { name?: string | null; email?: string | null };
  people: CouponPersonRow[];
  userId?: string;
  personId: string | null;
  typed: string;
  onPerson: (id: string | null) => void;
  onTyped: (v: string) => void;
}

// Escolha do cupom: automático, uma ficha sugerida pelo nome/e-mail (mostrando os códigos) ou códigos digitados.
export function CouponPicker({ id, account, people, userId, personId, typed, onPerson, onTyped }: Props) {
  const atual = people.find((p) => userId && p.userId === userId);
  const sugestoes = useMemo(() => suggestCouponPeople(account, people), [account.name, account.email, people]);
  const opcoes = atual ? [atual, ...sugestoes.filter((s) => s.id !== atual.id)] : sugestoes;
  const novos = parseCodes(typed);
  const repetido = novos.map((c) => people.find((p) => p.id !== atual?.id && p.codes.some((x) => x.toUpperCase() === c))).find(Boolean);

  const chip = (ativo: boolean) =>
    cn("flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
      ativo ? "border-foreground bg-muted" : "border-border hover:bg-muted/60");

  return (
    <div className="space-y-2">
      <Label>Cupons</Label>
      <div className="space-y-1.5">
        {!atual && (
          <button type="button" className={chip(!personId && !typed)} onClick={() => { onPerson(null); onTyped(""); }}>
            <span>Automático <span className="text-muted-foreground">· liga sozinho quando o cupom existir</span></span>
            {!personId && !typed && <Check className="h-4 w-4" />}
          </button>
        )}
        {opcoes.map((p) => (
          <button key={p.id} type="button" className={chip(personId === p.id && !typed)} onClick={() => { onPerson(p.id); onTyped(""); }}>
            <span className="min-w-0">
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{uniqueCodes(p.codes).join(" · ") || "sem código"}</span>
            </span>
            {personId === p.id && !typed && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
        {atual && (
          <button type="button" className={chip(!personId && !typed)} onClick={() => { onPerson(null); onTyped(""); }}>
            <span className="text-muted-foreground">Sem cupom</span>
            {!personId && !typed && <Check className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="space-y-1 pt-1">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          {atual ? "Adicionar outro código a esta pessoa" : "Não está na lista? Escreva o código"}
        </Label>
        <Input id={id} value={typed} onChange={(e) => onTyped(cleanCodeInput(e.target.value))} placeholder="ex.: ANA5, ANA10" className="font-mono uppercase" maxLength={80} />
        {repetido && (
          <p className="text-xs text-muted-foreground">
            Esse código já é de <b className="text-foreground">{repetido.name}</b>.{" "}
            {!repetido.userId && (
              <button type="button" className="underline underline-offset-2" onClick={() => { onPerson(repetido.id); onTyped(""); }}>Escolher essa ficha</button>
            )}
          </p>
        )}
        {!repetido && novos.length > 0 && <p className="text-xs text-muted-foreground">Só letras e números. Mais de um código? Separe por vírgula.</p>}
      </div>
    </div>
  );
}

export function typedCodesOk(typed: string, people: CouponPersonRow[], currentId?: string | null) {
  return !parseCodes(typed).some((c) => people.some((p) => p.id !== currentId && p.codes.some((x) => x.toUpperCase() === c)));
}
