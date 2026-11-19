import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { criteriosSenha } from "@/lib/passwordRules";
import { cn } from "@/lib/utils";

// Senha + confirmação com as regras logo abaixo, pequenas e discretas: cinza enquanto faltam, verdes quando cumpridas.
// Mesmo bloco na criação de senha, no Meu perfil e na edição de usuário.
export function PasswordFields({ id, senha, confirmacao, onSenha, onConfirmacao, rotulo = "Nova senha" }: {
  id: string;
  senha: string;
  confirmacao: string;
  onSenha: (v: string) => void;
  onConfirmacao: (v: string) => void;
  rotulo?: string;
}) {
  const criterios = criteriosSenha(senha, confirmacao);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-senha`}>{rotulo}</Label>
        <PasswordInput id={`${id}-senha`} autoComplete="new-password" value={senha} onChange={(e) => onSenha(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-confirma`}>Confirme a senha</Label>
        <PasswordInput id={`${id}-confirma`} autoComplete="new-password" value={confirmacao} onChange={(e) => onConfirmacao(e.target.value)} />
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Regras da senha">
        {criterios.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-1", c.ok ? "text-ok" : "text-muted-foreground")}>
            <Check className={cn("h-3 w-3", !c.ok && "opacity-30")} />
            {c.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function senhaValida(senha: string, confirmacao: string) {
  return criteriosSenha(senha, confirmacao).every((c) => c.ok);
}
