// Regra única de nomes: cada palavra com a primeira letra maiúscula e o resto minúsculo, mantendo acentos.
export function formatPersonName(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR"))
    .join(" ");
}

// Nome a partir do e-mail: alice.santos@cupola.com.br → Alice Santos.
export function nameFromEmail(email: string | null | undefined): string {
  return formatPersonName((email ?? "").split("@")[0].replace(/[._-]+/g, " "));
}

// Primeiro nome formatado; se o nome guardado for um e-mail, usa a parte antes do @.
export function firstName(name: string | null | undefined, email?: string | null): string {
  const base = name && !name.includes("@") ? formatPersonName(name) : nameFromEmail(name || email);
  return base.split(" ")[0] ?? "";
}
