import { Eye, Shield, Trophy, UserRound, type LucideIcon } from "lucide-react";

// Lista única de papéis. Papel novo: criar no enum app_role (Lovable) e incluir aqui.
// Só o admin vê todos os eventos sempre; qualquer outro papel segue o acesso escolhido.
export const ROLES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "viewer", label: "Visualizador", icon: Eye },
  { value: "seller", label: "Equipe de venda", icon: Trophy },
  { value: "admin", label: "Admin", icon: Shield },
];

export const ADMIN_ROLE = "admin";
export const DEFAULT_ROLE = "viewer";

export function roleInfo(value: string) {
  return ROLES.find((r) => r.value === value) ?? { value, label: value, icon: UserRound };
}
