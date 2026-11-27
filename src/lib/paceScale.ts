// Presentation only: round the domain, never normalize every goal to the midpoint.
export function escalaDoRitmo(valor: number, meta: number | null, referencia = 0) {
  const maior = Math.max(valor, meta ?? 0, referencia, 1);
  const passo = 10 ** Math.floor(Math.log10(maior)) / 5;
  const maximo = Math.ceil((maior * 1.2) / passo) * passo;
  return {
    maximo,
    realizado: Math.min(Math.max(valor / maximo, 0), 1),
    marcador: meta === null ? null : Math.min(Math.max(meta / maximo, 0), 1),
  };
}