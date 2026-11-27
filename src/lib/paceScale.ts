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

// Geometria do velocímetro: meio círculo de 180°, centro (cx, cy), raio r,
// traço de espessura stroke. O viewBox é simétrico em relação a cx, então o
// arco continua centralizado no card mesmo com folga para o rótulo da meta.
export const GAUGE = {
  cx: 100,
  cy: 96,
  r: 80,
  stroke: 16,
  vb: { x: -34, y: -34, w: 268, h: 156 },
};

// Rótulo do marcador de meta, em duas linhas (título + número).
// Fica afastado do arco e sobe conforme o marcador se aproxima das pontas:
// assim o texto nunca encosta no arco nem sai do viewBox (o número já foi cortado).
export function rotuloDoMarcador(frac: number, titulo: string, valor: string) {
  const f = Math.min(Math.max(frac, 0), 1);
  const ang = Math.PI * (1 - f);
  const sen = Math.sin(ang);
  const raio = GAUGE.r + 28;
  const x = GAUGE.cx + raio * Math.cos(ang);
  const y = GAUGE.cy - raio * sen - 14 * (1 - sen);
  const w = Math.max(titulo.length * 5.4, valor.length * 6.6);
  const h = 19;
  return { x, y, w, h, baselines: { titulo: y - 4, valor: y + 8 } };
}