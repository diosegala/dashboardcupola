export const MIN_SENHA = 8;

export type Criterio = { id: string; texto: string; ok: boolean };

/** Critérios exibidos ao criar senha; todos precisam estar ok para salvar. */
export function criteriosSenha(senha: string, confirmacao: string): Criterio[] {
  return [
    { id: "tamanho", texto: `Pelo menos ${MIN_SENHA} caracteres`, ok: senha.length >= MIN_SENHA },
    { id: "maiuscula", texto: "Uma letra maiúscula", ok: /[A-ZÀ-Ý]/.test(senha) },
    { id: "minuscula", texto: "Uma letra minúscula", ok: /[a-zß-ÿ]/.test(senha) },
    { id: "numero", texto: "Um número", ok: /\d/.test(senha) },
    { id: "iguais", texto: "As duas senhas são iguais", ok: senha.length > 0 && senha === confirmacao },
  ];
}

/** Sem senha criada (password_set_at), a pessoa não entra no painel. */
export function precisaCriarSenha(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  if (!user) return false;
  return !user.user_metadata?.password_set_at;
}
