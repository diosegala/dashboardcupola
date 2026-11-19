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

// Separa em nome e sobrenome para os campos do cadastro. Sem nome, ou sem sobrenome,
// sugere a partir do e-mail (robson.silva@… → Robson / Silva) quando o e-mail tiver mais partes.
export function splitName(name: string | null | undefined, email?: string | null): { first: string; last: string } {
  const guardado = name && !name.includes("@") ? formatPersonName(name) : "";
  const doEmail = nameFromEmail(email);
  const [first = "", ...resto] = (guardado || doEmail).split(" ");
  let last = resto.join(" ");
  if (!last) {
    const [primeiroEmail, ...restoEmail] = doEmail.split(" ");
    if (restoEmail.length && primeiroEmail.toLocaleLowerCase("pt-BR") === first.toLocaleLowerCase("pt-BR")) last = restoEmail.join(" ");
  }
  return { first, last };
}

// Nome completo guardado a partir dos dois campos.
export function joinName(first: string, last: string): string {
  return formatPersonName(`${first} ${last}`);
}

// Nome guardado sem sobrenome (uma palavra só, ou vazio, ou e-mail).
export function lacksSurname(name: string | null | undefined): boolean {
  return !name || name.includes("@") || formatPersonName(name).split(" ").length < 2;
}
