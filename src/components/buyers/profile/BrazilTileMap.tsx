import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { VIZ } from "@/components/buyers/profile/ProfileViz";

const int = (n: number) => n.toLocaleString("pt-BR");

// Brasil em quadradinhos: cada estado no seu lugar aproximado do mapa (linha, coluna).
const ESTADOS: { uf: string; nome: string; regiao: Regiao; l: number; c: number }[] = [
  { uf: "RR", nome: "Roraima", regiao: "Norte", l: 0, c: 2 },
  { uf: "AP", nome: "Amapá", regiao: "Norte", l: 0, c: 4 },
  { uf: "AM", nome: "Amazonas", regiao: "Norte", l: 1, c: 1 },
  { uf: "PA", nome: "Pará", regiao: "Norte", l: 1, c: 3 },
  { uf: "MA", nome: "Maranhão", regiao: "Nordeste", l: 1, c: 4 },
  { uf: "CE", nome: "Ceará", regiao: "Nordeste", l: 1, c: 5 },
  { uf: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste", l: 1, c: 6 },
  { uf: "AC", nome: "Acre", regiao: "Norte", l: 2, c: 0 },
  { uf: "RO", nome: "Rondônia", regiao: "Norte", l: 2, c: 1 },
  { uf: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste", l: 2, c: 2 },
  { uf: "TO", nome: "Tocantins", regiao: "Norte", l: 2, c: 3 },
  { uf: "PI", nome: "Piauí", regiao: "Nordeste", l: 2, c: 4 },
  { uf: "PE", nome: "Pernambuco", regiao: "Nordeste", l: 2, c: 5 },
  { uf: "PB", nome: "Paraíba", regiao: "Nordeste", l: 2, c: 6 },
  { uf: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", l: 3, c: 2 },
  { uf: "GO", nome: "Goiás", regiao: "Centro-Oeste", l: 3, c: 3 },
  { uf: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste", l: 3, c: 4 },
  { uf: "BA", nome: "Bahia", regiao: "Nordeste", l: 3, c: 5 },
  { uf: "AL", nome: "Alagoas", regiao: "Nordeste", l: 3, c: 6 },
  { uf: "SP", nome: "São Paulo", regiao: "Sudeste", l: 4, c: 3 },
  { uf: "MG", nome: "Minas Gerais", regiao: "Sudeste", l: 4, c: 4 },
  { uf: "ES", nome: "Espírito Santo", regiao: "Sudeste", l: 4, c: 5 },
  { uf: "SE", nome: "Sergipe", regiao: "Nordeste", l: 4, c: 6 },
  { uf: "PR", nome: "Paraná", regiao: "Sul", l: 5, c: 3 },
  { uf: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste", l: 5, c: 4 },
  { uf: "RS", nome: "Rio Grande do Sul", regiao: "Sul", l: 6, c: 2 },
  { uf: "SC", nome: "Santa Catarina", regiao: "Sul", l: 6, c: 3 },
];

type Regiao = "Sul" | "Sudeste" | "Centro-Oeste" | "Nordeste" | "Norte";
const REGIOES: Regiao[] = ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Norte"];
// Cada região tem uma cor fixa; a força da cor mostra quantas pessoas vêm do estado.
const COR_REGIAO: Record<Regiao, string> = { Sul: VIZ[1], Sudeste: VIZ[0], "Centro-Oeste": VIZ[2], Nordeste: VIZ[3], Norte: VIZ[4] };

export function BrazilTileMap({ porUf }: { porUf: Record<string, number> }) {
  const [foco, setFoco] = useState<string | null>(null);
  const [regiaoFoco, setRegiaoFoco] = useState<Regiao | null>(null);
  const total = Object.values(porUf).reduce((s, n) => s + n, 0);
  const max = Math.max(...Object.values(porUf), 1);
  const porRegiao = useMemo(
    () =>
      REGIOES.map((r) => ({ regiao: r, total: ESTADOS.filter((e) => e.regiao === r).reduce((s, e) => s + (porUf[e.uf] ?? 0), 0) }))
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total),
    [porUf],
  );
  const estadoFoco = ESTADOS.find((e) => e.uf === foco);
  const pctDe = (v: number) => `${Math.round((v / (total || 1)) * 100)}%`;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="grid shrink-0 grid-cols-7 gap-1" role="img" aria-label={`Pessoas por estado: ${Object.entries(porUf).map(([uf, n]) => `${uf} ${n}`).join(", ")}`}>
        {Array.from({ length: 7 * 7 }, (_, i) => {
          const l = Math.floor(i / 7);
          const c = i % 7;
          const e = ESTADOS.find((x) => x.l === l && x.c === c);
          if (!e) return <span key={i} className="h-10 w-10" />;
          const v = porUf[e.uf] ?? 0;
          const forca = v > 0 ? Math.round(22 + 78 * Math.sqrt(v / max)) : 0;
          const apagado = (regiaoFoco && regiaoFoco !== e.regiao) || (foco && foco !== e.uf);
          return (
            <button
              key={e.uf}
              type="button"
              onMouseEnter={() => setFoco(e.uf)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(e.uf)}
              onBlur={() => setFoco(null)}
              aria-label={`${e.nome}: ${int(v)} pessoas`}
              className={cn(
                "flex h-10 w-10 animate-[pop-in_520ms_cubic-bezier(.16,1,.3,1)_both] flex-col items-center justify-center rounded-[10px] text-[11px] font-semibold leading-none transition-[opacity,transform] duration-150 hover:scale-110",
                apagado && "opacity-30",
                forca > 70 ? "text-white" : v > 0 ? "text-foreground" : "text-muted-foreground/70",
              )}
              style={{
                background: v > 0 ? `color-mix(in oklab, ${COR_REGIAO[e.regiao]} ${forca}%, hsl(var(--secondary)))` : "hsl(var(--secondary))",
                animationDelay: `${l * 60 + c * 30}ms`,
              }}
            >
              {e.uf}
              {v > 0 && <span className="mt-0.5 text-[9px] font-medium tabular-nums opacity-85">{int(v)}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex min-w-[180px] flex-1 flex-col gap-3">
        <p className="min-h-[20px] text-sm">
          {estadoFoco ? (
            <>
              <b className="font-semibold">{estadoFoco.nome}</b>: {int(porUf[estadoFoco.uf] ?? 0)} {porUf[estadoFoco.uf] === 1 ? "pessoa" : "pessoas"}
              {porUf[estadoFoco.uf] ? <span className="text-muted-foreground"> · {pctDe(porUf[estadoFoco.uf])}</span> : null}
            </>
          ) : (
            <span className="text-muted-foreground">Passe o mouse num estado.</span>
          )}
        </p>
        <ul className="flex flex-col gap-1.5">
          {porRegiao.map((r) => (
            <li
              key={r.regiao}
              onMouseEnter={() => setRegiaoFoco(r.regiao)}
              onMouseLeave={() => setRegiaoFoco(null)}
              className={cn("rounded-xl px-2 py-1 transition-[background-color,opacity] hover:bg-secondary", regiaoFoco && regiaoFoco !== r.regiao && "opacity-40")}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2">
                  <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_REGIAO[r.regiao] }} />
                  {r.regiao}
                </span>
                <span className="tabular-nums">
                  <b className="font-semibold">{int(r.total)}</b>
                  <span className="ml-2 text-muted-foreground">{pctDe(r.total)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <i
                  className="block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full"
                  style={{ width: `${(r.total / (total || 1)) * 100}%`, background: COR_REGIAO[r.regiao] }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Sigla do estado a partir do que a Sympla grava ("RS", "Porto Alegre - RS", "rs").
export function ufDe(estado: string | null | undefined): string | null {
  const uf = (estado ?? "").trim().toUpperCase().slice(-2);
  return ESTADOS.some((e) => e.uf === uf) ? uf : null;
}
