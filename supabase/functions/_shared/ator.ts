// Quem age numa gravação feita pelo servidor. O banco só aceita estes cabeçalhos de quem usa a chave de serviço,
// então ninguém consegue se passar por outra pessoa. Sem eles, o log marca "servidor sem identificação".
export function atorHeaders(processo: string, actorId?: string | null): Record<string, string> {
  return { "x-actor-processo": processo, ...(actorId ? { "x-actor-id": actorId } : {}) };
}
