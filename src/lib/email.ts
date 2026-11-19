// Confere só a escrita do e-mail (não se ele existe). Usada em todos os campos de e-mail.

// Espaços nas pontas saem sozinhos; letras maiúsculas viram minúsculas.
export function limparEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

// Devolve o motivo do erro, ou null se a escrita estiver certa.
export function erroEmail(valor: string): string | null {
  const email = limparEmail(valor);
  if (!email) return "Informe o e-mail";
  if (/\s/.test(email)) return "O e-mail não pode ter espaços";
  const arrobas = email.split("@").length - 1;
  if (arrobas === 0) return "Falta o @";
  if (arrobas > 1) return "O e-mail só pode ter um @";
  if (email.length > 254) return "E-mail longo demais";

  const [local, dominio] = email.split("@");
  if (!local) return "Falta a parte antes do @";
  if (local.length > 64) return "A parte antes do @ é longa demais";
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return "Há caracteres inválidos antes do @";
  if (local.startsWith(".") || local.endsWith(".")) return "O e-mail não pode ter ponto logo no início ou antes do @";

  if (!dominio) return "Falta o domínio depois do @";
  if (!dominio.includes(".")) return "Falta o ponto no domínio (ex.: empresa.com.br)";
  if (!/^[a-z0-9.-]+$/.test(dominio)) return "Há caracteres inválidos depois do @";
  if (email.includes("..")) return "O e-mail não pode ter dois pontos seguidos";
  const partes = dominio.split(".");
  if (partes.some((p) => !p)) return "O domínio não pode começar ou terminar com ponto";
  if (partes.some((p) => p.startsWith("-") || p.endsWith("-"))) return "O domínio não pode ter hífen no início ou no fim de uma parte";
  if (partes.some((p) => p.length > 63)) return "Uma parte do domínio é longa demais";
  if (!/^[a-z]{2,}$/.test(partes[partes.length - 1])) return "O final do domínio está incompleto (ex.: .com, .br)";
  return null;
}

// E-mail é único: nomes podem repetir, e-mails nunca. Confere na lista de usuários já carregada.
export function emailJaUsado(valor: string, contas: { id: string; email: string | null }[] | undefined, excetoId?: string): string | null {
  const email = limparEmail(valor);
  if (!email || !contas) return null;
  return contas.some((u) => u.id !== excetoId && limparEmail(u.email ?? "") === email)
    ? "Já existe um usuário com este e-mail"
    : null;
}
