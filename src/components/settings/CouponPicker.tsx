import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import type { CouponPersonRow } from "@/hooks/useCouponPeople";
import { cleanCodeInput, parseCodes, suggestCouponPeople, uniqueCodes } from "@/lib/couponLink";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";

interface Props {
  id: string;
  account: { name?: string | null; email?: string | null };
  people: CouponPersonRow[];
  userId?: string;
  personIds: string[];
  typed: string;
  onPeople: (ids: string[]) => void;
  onTyped: (v: string) => void;
}

// Escolha dos cupons: automático, uma ou várias fichas da lista (mostrando os códigos) ou códigos digitados.
export function CouponPicker({ id, account, people, userId, personIds, typed, onPeople, onTyped }: Props) {
  const atuais = people.filter((p) => userId && p.userId === userId);
  const atualIds = atuais.map((p) => p.id);
  const sugestoes = useMemo(() => suggestCouponPeople(account, people), [account.name, account.email, people]);
  const opcoes = [...atuais, ...sugestoes.filter((s) => !atualIds.includes(s.id))];
  const novos = parseCodes(typed);
  const [rascunho, setRascunho] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; ficha?: CouponPersonRow } | null>(null);
  // Enter transforma o texto em etiqueta. Código é único: não entra repetido nem se já for de outra pessoa.
  const adicionar = () => {
    const c = rascunho.trim().toUpperCase();
    if (!c) return;
    if (novos.includes(c)) return setAviso({ texto: "Esse código já foi adicionado." });
    const dono = people.find((p) => p.codes.some((x) => x.toUpperCase() === c));
    if (dono && atualIds.includes(dono.id)) return setAviso({ texto: "Esse código já é desta pessoa." });
    if (dono) return setAviso({ texto: `Esse código já é de ${dono.name}.`, ficha: dono });
    onTyped([...novos, c].join(","));
    setRascunho("");
    setAviso(null);
  };
  const nenhum = personIds.length === 0;
  const todos = opcoes.length > 0 && opcoes.every((p) => personIds.includes(p.id));
  const alternar = (pid: string) => onPeople(personIds.includes(pid) ? personIds.filter((x) => x !== pid) : [...personIds, pid]);

  const chip = (ativo: boolean) =>
    cn("flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
      ativo ? "border-foreground bg-muted" : "border-border hover:bg-muted/60");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label>Cupons</Label>
        <InfoTip title="Cupons" text="Estes cupons já existem no cadastro e, pelo nome ou e-mail, podem ser desta pessoa. Cada cupom pertence a uma só pessoa, mas uma pessoa pode ter mais de um cupom: marque quantos forem dela. Se escolher Automático, o painel faz a ligação sozinho quando encontrar o cupom dela." />
        {opcoes.length > 1 && (
          <button type="button" className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onPeople(todos ? [] : opcoes.map((p) => p.id))}>
            {todos ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <button type="button" className={chip(nenhum)} onClick={() => onPeople([])}>
          {atuais.length
            ? <span className="text-muted-foreground">Sem cupom</span>
            : <span>Automático <span className="text-muted-foreground">· liga sozinho quando o cupom existir</span></span>}
          {nenhum && <Check className="h-4 w-4" />}
        </button>
        {opcoes.map((p) => (
          <button key={p.id} type="button" className={chip(personIds.includes(p.id))} onClick={() => alternar(p.id)} aria-pressed={personIds.includes(p.id)}>
            <span className="min-w-0">
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{uniqueCodes(p.codes).join(" · ") || "sem código"}</span>
            </span>
            {personIds.includes(p.id) && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>
      <div className="space-y-1 pt-1">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
            {atuais.length ? "Adicionar outro código a esta pessoa" : "Não está na lista? Escreva o código"}
          </Label>
          <InfoTip title="Código do cupom" text="Escreva o código exatamente igual ao criado na Sympla e aperte Enter: ele vira uma etiqueta. Errou? Clique no x da etiqueta e escreva de novo. Cada código pertence a uma só pessoa." />
        </div>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
          {novos.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-xs">
              {c}
              <button type="button" aria-label={`Remover ${c}`} className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => onTyped(novos.filter((x) => x !== c).join(","))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id={id}
            value={rascunho}
            onChange={(e) => { setRascunho(cleanCodeInput(e.target.value).replace(/,/g, "")); setAviso(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); adicionar(); }
              else if (e.key === "Backspace" && !rascunho && novos.length) onTyped(novos.slice(0, -1).join(","));
            }}
            placeholder={novos.length ? "" : "ex.: ANA5 e Enter"}
            className="min-w-[8rem] flex-1 bg-transparent font-mono text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
            maxLength={30}
          />
        </div>
        {aviso && (
          <p className="text-xs text-destructive">
            {aviso.texto}{" "}
            {aviso.ficha && !aviso.ficha.userId && (
              <button type="button" className="underline underline-offset-2" onClick={() => { onPeople([...personIds, aviso.ficha!.id]); setRascunho(""); setAviso(null); }}>Escolher essa ficha</button>
            )}
          </p>
        )}
        {!aviso && rascunho && <p className="text-xs text-muted-foreground">Aperte Enter para adicionar.</p>}
      </div>
    </div>
  );
}

export function typedCodesOk(typed: string, people: CouponPersonRow[], currentIds: string[] = []) {
  return !parseCodes(typed).some((c) => people.some((p) => !currentIds.includes(p.id) && p.codes.some((x) => x.toUpperCase() === c)));
}
