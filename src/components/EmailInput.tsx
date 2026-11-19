import { useState } from "react";
import { Input } from "@/components/ui/input";
import { erroEmail } from "@/lib/email";

// Campo de e-mail único do app: tira espaços das pontas enquanto digita e
// avisa quando a escrita não segue o padrão (sem checar se o e-mail existe).
export function EmailInput({ id, value, onChange, placeholder = "nome@empresa.com.br", autoComplete = "email" }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [saiu, setSaiu] = useState(false);
  const erro = value ? erroEmail(value) : null;
  // Mostra o aviso depois que a pessoa sai do campo, ou na hora se já houver espaço no meio.
  const mostrar = !!erro && (saiu || /\s/.test(value));
  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="email"
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        onBlur={() => setSaiu(true)}
        placeholder={placeholder}
        maxLength={254}
        aria-invalid={mostrar}
        aria-describedby={mostrar ? `${id}-erro` : undefined}
        required
      />
      {mostrar && <p id={`${id}-erro`} className="text-xs text-destructive">{erro}</p>}
    </>
  );
}
