// Lê uma consulta em páginas de 1000 linhas, várias páginas ao mesmo tempo (em vez de uma depois da outra).
// Para quando alguma página volta incompleta. Erro: lança se `throwOnError`, senão devolve o que já leu.
export const PAGE_SIZE = 1000;
const PARALELO = 4;

export async function fetchAllPages<T = any>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { throwOnError = false }: { throwOnError?: boolean } = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let base = 0; ; base += PAGE_SIZE * PARALELO) {
    const lotes = await Promise.all(
      Array.from({ length: PARALELO }, (_, i) => {
        const from = base + i * PAGE_SIZE;
        return page(from, from + PAGE_SIZE - 1);
      }),
    );
    for (const { data, error } of lotes) {
      if (error) {
        if (throwOnError) throw error;
        return all;
      }
      all.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) return all;
    }
  }
}
