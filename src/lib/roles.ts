import { Eye, Shield, Trophy, UserRound, type LucideIcon } from "lucide-react";

// Lista única de papéis, do principal para o menor (a ordem também ordena a lista de usuários).
// Papel novo: criar no enum app_role (Lovable) e incluir aqui na posição certa.
// Só o admin vê todos os eventos sempre; qualquer outro papel segue o acesso escolhido.
export const ROLES: { value: string; label: string; icon: LucideIcon; importable: boolean }[] = [
  { value: "admin", label: "Administrador", icon: Shield, importable: false },
  { value: "seller", label: "Ranking", icon: Trophy, importable: true },
  { value: "viewer", label: "Visualizador", icon: Eye, importable: true },
];

export const ADMIN_ROLE = "admin";
export const DEFAULT_ROLE = "viewer";
// Conta sem nenhuma função gravada: o painel mostra "Sem função", nunca inventa uma.
export const NO_ROLE = "";
export const NO_ROLE_LABEL = "Sem função";

// Função real da pessoa, exatamente como está gravada. Sem registro, fica sem função.
// O banco aceita só uma por pessoa; se aparecerem várias, vale a mais alta (a que dá mais acesso).
export function realRole(gravadas: string[]): string {
  if (!gravadas.length) return NO_ROLE;
  return [...gravadas].sort((a, b) => roleRank(a) - roleRank(b))[0];
}

export function roleInfo(value: string) {
  return ROLES.find((r) => r.value === value) ?? { value, label: value, icon: UserRound, importable: false };
}

// Posição do papel na hierarquia; papel fora da lista vai para o fim.
export function roleRank(value: string) {
  const i = ROLES.findIndex((r) => r.value === value);
  return i === -1 ? ROLES.length : i;
}
