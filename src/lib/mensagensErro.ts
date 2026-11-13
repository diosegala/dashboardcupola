// Traduz mensagens de erro técnicas (Supabase, Postgres, rede) para português do Brasil.
// Toda mensagem de erro mostrada ao usuário deve passar por aqui.

const MENSAGEM_PADRAO = "Algo deu errado. Tente novamente em instantes.";

const TRADUCOES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada."],
  [/user already registered|already been registered/i, "Já existe uma conta com este e-mail."],
  [/user not found/i, "Não encontramos uma conta com este e-mail."],
  [/new password should be different/i, "A nova senha precisa ser diferente da senha atual."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos 6 caracteres."],
  [/known to be weak|pwned|leaked/i, "Essa senha já apareceu em vazamentos na internet. Escolha outra, de preferência uma frase com números."],
  [/password is too weak|weak password/i, "Essa senha é fraca demais. Use uma senha mais forte."],
  [/unable to validate email|invalid email|email address .* is invalid/i, "Digite um e-mail válido."],
  [/rate limit|too many requests|for security purposes/i, "Muitas tentativas seguidas. Aguarde um instante e tente de novo."],
  [/signups? not allowed|signup is disabled/i, "O cadastro de novos usuários não está liberado."],
  [/auth session missing|session.*(expired|not found)|jwt expired|invalid jwt|refresh token/i, "Sua sessão expirou. Entre novamente."],
  [/token has expired|otp.*expired|link.*(expired|invalid)|invalid.*token/i, "Este link expirou ou já foi usado. Peça um novo."],
  [/failed to fetch|networkerror|network request failed|load failed/i, "Sem conexão com o servidor. Verifique sua internet e tente de novo."],
  [/duplicate key|already exists|unique constraint/i, "Este registro já existe."],
  [/row-level security|permission denied|not authorized|forbidden|insufficient/i, "Você não tem permissão para fazer isso."],
  [/violates foreign key/i, "Este item está vinculado a outros registros e não pode ser alterado."],
  [/violates not-null|null value in column/i, "Faltou preencher um campo obrigatório."],
  [/timeout|timed out/i, "A operação demorou demais. Tente novamente."],
];

// Mensagens que já estão em português (escritas pelo próprio app) passam direto.
const PARECE_PORTUGUES = /[ãõçáéíóúâêôà]|\b(não|nao|erro|sem|para|você|voce|deu|salvar|usuário|senha|campo)\b/i;

export function traduzirErro(erro: unknown): string {
  const bruta =
    typeof erro === "string"
      ? erro
      : erro && typeof erro === "object" && "message" in erro
        ? String((erro as { message?: unknown }).message ?? "")
        : "";

  if (!bruta.trim()) return MENSAGEM_PADRAO;

  for (const [padrao, texto] of TRADUCOES) {
    if (padrao.test(bruta)) return texto;
  }

  return PARECE_PORTUGUES.test(bruta) ? bruta : MENSAGEM_PADRAO;
}
