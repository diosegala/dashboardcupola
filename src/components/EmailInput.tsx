import { useState } from "react";
import { Input } from "@/components/ui/input";
import { erroEmail } from "@/lib/email";

// Campo de e-mail único do app: tira espaços das pontas enquanto digita e
// avisa quando a escrita não segue o padrão (sem checar se o e-mail existe).
export function EmailInput({ id, value, onChange, placeholder = "nome@empresa.com.br", autoComplete = "email", extraError }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  // Erro de regra da tela (ex.: e-mail já usado por outra conta), mostrado na hora.
  extraError?: string | null;
}) {
  const [saiu, setSaiu] = useState(false);
  const erroEscrita = value ? erroEmail(value) : null;
  const erro = erroEscrita ?? extraError ?? null;
  // Escrita errada aparece ao sair do campo (ou na hora, com espaço no meio); e-mail já usado aparece na hora.
  const mostrar = !!erro && (saiu || /\s/.test(value) || (!erroEscrita && !!extraError));
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
