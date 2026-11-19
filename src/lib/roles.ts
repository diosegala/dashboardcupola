import { Eye, Shield, Trophy, UserRound, type LucideIcon } from "lucide-react";

// Lista única de papéis, do principal para o menor (a ordem também ordena a lista de usuários).
// Papel novo: criar no enum app_role (Lovable) e incluir aqui na posição certa.
// Só o admin vê todos os eventos sempre; qualquer outro papel segue o acesso escolhido.
export const ROLES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "admin", label: "Admin", icon: Shield },
  { value: "seller", label: "Só ranking", icon: Trophy },
  { value: "viewer", label: "Visualizador", icon: Eye },
];

export const ADMIN_ROLE = "admin";
export const DEFAULT_ROLE = "viewer";

export function roleInfo(value: string) {
  return ROLES.find((r) => r.value === value) ?? { value, label: value, icon: UserRound };
}

// Posição do papel na hierarquia; papel fora da lista vai para o fim.
export function roleRank(value: string) {
  const i = ROLES.findIndex((r) => r.value === value);
  return i === -1 ? ROLES.length : i;
}
