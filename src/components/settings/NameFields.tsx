import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Nome e sobrenome obrigatórios, lado a lado. Mesmo bloco no convite e na edição.
export function NameFields({ id, first, last, onFirst, onLast }: {
  id: string;
  first: string;
  last: string;
  onFirst: (v: string) => void;
  onLast: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${id}-nome`}>Nome</Label>
        <Input id={`${id}-nome`} value={first} onChange={(e) => onFirst(e.target.value)} maxLength={60} autoComplete="given-name" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-sobrenome`}>Sobrenome</Label>
        <Input id={`${id}-sobrenome`} value={last} onChange={(e) => onLast(e.target.value)} maxLength={60} autoComplete="family-name" required />
        {!last.trim() && <p className="text-xs text-destructive">Informe o sobrenome</p>}
      </div>
    </div>
  );
}
