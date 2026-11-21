// Toda tabela nova do painel precisa ligar a auditoria na mesma migração: `SELECT public.auditoria_ligar('<tabela>', ...)`.
// Usado pela checagem do build (vite.config.ts). Devolve as tabelas criadas sem a chamada.
export function tabelasSemAuditoria(sql: string): string[] {
  const semComentarios = sql.replace(/--.*$/gm, "");
  const criadas = [...semComentarios.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(criadas)].filter((t) => !new RegExp(`auditoria_ligar\\s*\\(\\s*'${t}'`, "i").test(semComentarios));
}

// Migrações anteriores à auditoria (0000–0015) já estão cobertas pelo cadastro inicial.
export const PRIMEIRA_MIGRACAO_CHECADA = 16;
