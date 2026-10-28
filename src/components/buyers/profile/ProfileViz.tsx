import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { cn } from "@/lib/utils";

// Peças visuais do Perfil: cada tipo de pergunta ganha a forma que conta melhor a sua história.

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
// Uma casa decimal quando o número é pequeno ou quando arredondar daria 100% sem ser todo mundo.
const pct = (v: number, total: number) => {
  const f = v / (total || 1);
  const casas = f < 0.1 || (f > 0.995 && v < total) ? 1 : 0;
  return `${Math.min(f * 100, v < total ? 99.9 : 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
};

// Cores fixas por ordem (nunca recicladas); o que passa disso vira "Outros", em cinza.
export const VIZ = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];
const OUTROS = "hsl(var(--muted-foreground) / 0.55)";

export interface Item {
  label: string;
  value: number;
}

// Mantém as n-1 maiores e junta o resto em "Outros".
export function topN(items: Item[], n: number): Item[] {
  if (items.length <= n) return items;
  const resto = items.slice(n - 1).reduce((s, i) => s + i.value, 0);
  return [...items.slice(0, n - 1), { label: "Outros", value: resto }];
}
const corDe = (items: Item[], i: number) => (items[i]?.label === "Outros" ? OUTROS : VIZ[i % VIZ.length]);

// Liga a animação só depois que a peça aparece (para o desenho acontecer na frente de quem olha).
function useMontado() {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return montado;
}

export function VizCard({ title, subtitle, className, children }: { title: string; subtitle?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-5 transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-line-strong", className)}>
      <div>
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          {title} <InfoTip title={title} />
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

// Legenda com cor, nome, quantidade e %; passar o mouse destaca a parte no gráfico.
function Legenda({ items, total, ativo, setAtivo }: { items: Item[]; total: number; ativo: number | null; setAtivo: (i: number | null) => void }) {
  return (
    <ul className="flex min-w-[220px] flex-1 flex-col gap-1">
      {items.map((it, i) => (
        <li
          key={it.label}
          onMouseEnter={() => setAtivo(i)}
          onMouseLeave={() => setAtivo(null)}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl px-2 py-1 text-[13px] transition-[background-color,opacity] duration-150 hover:bg-secondary",
            ativo !== null && ativo !== i && "opacity-40",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: corDe(items, i) }} />
            <span className="truncate">{it.label}</span>
          </span>
          <span className="shrink-0 tabular-nums">
            <b className="font-semibold">{int(it.value)}</b>
            <span className="ml-2 text-muted-foreground">{pct(it.value, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Rosca que se desenha ao aparecer; o centro mostra a parte em destaque.
export function DonutViz({ items: brutos }: { items: Item[] }) {
  const items = topN(brutos, 5);
  const total = items.reduce((s, i) => s + i.value, 0);
  const [ativo, setAtivo] = useState<number | null>(null);
  const montado = useMontado();
  const R = 52;
  const C = 2 * Math.PI * R;
  const folga = items.length > 1 ? 3 : 0;
  let inicio = 0;
  const foco = items[ativo ?? 0];

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[150px] w-[150px] shrink-0 -rotate-90" role="img" aria-label={items.map((i) => `${i.label}: ${int(i.value)}`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="18" />
        {items.map((it, i) => {
          const len = (it.value / (total || 1)) * C;
          const seg = (
            <circle
              key={it.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={corDe(items, i)}
              strokeWidth={ativo === i ? 24 : 18}
              strokeDasharray={`${montado ? Math.max(len - folga, 0.5) : 0} ${C}`}
              strokeDashoffset={-inicio}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-[1100ms] ease-cupola"
              style={{ transitionDelay: montado && ativo === null ? `${i * 120}ms` : "0ms", opacity: ativo !== null && ativo !== i ? 0.35 : 1 }}
            />
          );
          inicio += len;
          return seg;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="68" textAnchor="middle" className="fill-foreground text-[24px] font-semibold tracking-[-0.03em]">
            {foco ? pct(foco.value, total) : "—"}
          </text>
          <text x="70" y="86" textAnchor="middle" className="fill-muted-foreground text-[9.5px]">
            {foco ? (foco.label.length > 18 ? `${foco.label.slice(0, 17)}…` : foco.label) : ""}
          </text>
        </g>
      </svg>
      <Legenda items={items} total={total} ativo={ativo} setAtivo={setAtivo} />
    </div>
  );
}

// Grade de 100 quadradinhos: cada um é 1% das pessoas. Os quadradinhos entram um a um.
export function WaffleViz({ items: brutos }: { items: Item[] }) {
  const items = topN(brutos, 6);
  const total = items.reduce((s, i) => s + i.value, 0);
  const [ativo, setAtivo] = useState<number | null>(null);

  // Divide os 100 quadradinhos pelo maior resto, para somar sempre 100.
  const celulas = useMemo(() => {
    const exatos = items.map((it) => (it.value / (total || 1)) * 100);
    const base = exatos.map(Math.floor);
    let falta = 100 - base.reduce((s, n) => s + n, 0);
    exatos
      .map((e, i) => ({ i, resto: e - Math.floor(e) }))
      .sort((a, b) => b.resto - a.resto)
      .forEach(({ i }) => {
        if (falta > 0) {
          base[i] += 1;
          falta -= 1;
        }
      });
    return base.flatMap((n, i) => Array.from({ length: n }, () => i));
  }, [items, total]);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="grid shrink-0 grid-cols-10 gap-[3px]" role="img" aria-label={items.map((i) => `${i.label}: ${pct(i.value, total)}`).join(", ")}>
        {celulas.map((cat, n) => (
          <i
            key={n}
            onMouseEnter={() => setAtivo(cat)}
            onMouseLeave={() => setAtivo(null)}
            title={`${items[cat].label}: ${int(items[cat].value)} (${pct(items[cat].value, total)})`}
            className={cn(
              "block h-[13px] w-[13px] animate-[pop-in_520ms_cubic-bezier(.16,1,.3,1)_both] rounded-[3px] transition-[opacity,transform] duration-150",
              ativo !== null && ativo !== cat ? "opacity-25" : ativo === cat && "scale-110",
            )}
            style={{ background: corDe(items, cat), animationDelay: `${(n % 10) * 25 + Math.floor(n / 10) * 35}ms` }}
          />
        ))}
      </div>
      <Legenda items={items} total={total} ativo={ativo} setAtivo={setAtivo} />
    </div>
  );
}

// Nuvem de pílulas que balançam devagar: o tamanho mostra quantas pessoas deram aquela resposta.
export function CloudViz({ items, limite = 24, unidade = "pessoas" }: { items: Item[]; limite?: number; unidade?: string }) {
  const mostrados = items.slice(0, limite);
  const max = Math.max(...mostrados.map((i) => i.value), 1);
  const restantes = items.length - mostrados.length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {mostrados.map((it, n) => {
          const peso = Math.sqrt(it.value / max);
          return (
            <span
              key={it.label}
              title={`${it.label}: ${int(it.value)} ${it.value === 1 ? unidade.replace(/s$/, "") : unidade}`}
              className="group inline-flex animate-[pop-in_600ms_cubic-bezier(.16,1,.3,1)_both] cursor-default items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-transform duration-200 hover:scale-105"
              style={{
                fontSize: `${12 + peso * 9}px`,
                background: `color-mix(in oklab, ${VIZ[n % VIZ.length]} ${Math.round(10 + peso * 22)}%, transparent)`,
                animationDelay: `${n * 45}ms`,
              }}
            >
              <span className="inline-block animate-[bob_4s_ease-in-out_infinite]" style={{ animationDelay: `${(n % 7) * 0.45}s`, animationDuration: `${3.2 + (n % 5) * 0.6}s` }}>
                {it.label}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{int(it.value)}</span>
            </span>
          );
        })}
      </div>
      {restantes > 0 && <p className="mt-3 text-xs text-muted-foreground">e outras {int(restantes)} respostas com menos pessoas.</p>}
    </div>
  );
}

// Quando quase todo mundo responde a mesma coisa: um número grande e as exceções em destaque.
export function HighlightViz({ items }: { items: Item[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const [principal, ...outros] = items;
  const montado = useMontado();
  const frac = principal.value / (total || 1);
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 80 80" className="h-[96px] w-[96px] shrink-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke={VIZ[0]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${montado ? frac * C : 0} ${C}`}
          className="transition-[stroke-dasharray] duration-[1200ms] ease-cupola"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-[34px] font-semibold leading-none tracking-[-0.035em]">{pct(principal.value, total)}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          responderam <b className="font-semibold text-foreground">{principal.label}</b> ({int(principal.value)} de {int(total)})
        </p>
        {outros.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {outros.slice(0, 6).map((o, n) => (
              <span key={o.label} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `color-mix(in oklab, ${VIZ[(n + 1) % VIZ.length]} 16%, transparent)` }}>
                {o.label} <span className="tabular-nums text-muted-foreground">{int(o.value)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Escolhe a forma pelo jeito das respostas, para perguntas novas entrarem sozinhas com um gráfico que faz sentido.
export function vizFor(title: string, items: Item[]): "cloud" | "highlight" | "donut" | "waffle" {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (title === "Cidades" || title === "Empresas" || items.length > 8) return "cloud";
  if (items.length === 1 || (items.length > 1 && items[0].value / (total || 1) >= 0.8)) return "highlight";
  if (items.length <= 4) return "donut";
  return "waffle";
}
