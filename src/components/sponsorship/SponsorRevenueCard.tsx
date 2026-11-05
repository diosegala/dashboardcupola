import { useEffect, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/CountUp";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { useCompare } from "@/hooks/useCompare";
import type { SponsorshipGoals, WeekPoint } from "@/lib/sponsorshipMetrics";
import { cn } from "@/lib/utils";

// Reais sem centavos.
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const curto = (n: number) =>
  n >= 1_000_000 ? `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : n >= 1000 ? `R$ ${Math.round(n / 1000).toLocaleString("pt-BR")} mil` : brl(n);
const vezes = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

export const REVENUE_INFO = {
  card: "Soma dos produtos com o termo do evento e o código de patrocínio em negócios ganhos do funil do evento. A pista mostra o vendido (sólido), o que está em negociação (listrado) e as marcas de comparação.",
  negociacao: "Produtos do evento nos negócios abertos do funil. Negócio aberto ainda sem produto entra pelo valor do negócio. Cota com R$ 0 no Pipedrive soma R$ 0.",
  cobertura: "Valor em negociação ÷ quanto falta para a meta ampliada. Abaixo de 3 vezes, o funil não tem negócios suficientes para chegar lá.",
  falta: "Quanto falta vender para chegar ao total que a edição anterior fechou.",
  potencial: "Vendido + em negociação: o que entra se todos os negócios abertos fecharem pelo valor de hoje.",
  pista: "Sólido = vendido. Listrado = em negociação. As marcas mostram a edição anterior na mesma data, o total que ela fechou e as metas do menu Metas.",
  curva: "Receita acumulada semana a semana desta edição. Com Comparar ligado, a linha pontilhada é a edição anterior no mesmo número de dias antes do evento.",
};

interface Props {
  vendido: number;
  emNegociacao: number;
  negociosAbertos: number;
  abertosSemValor?: number;
  goals: SponsorshipGoals;
  // Edição anterior: na mesma data e o total que ela fechou.
  anterior?: number | null;
  anteriorTotal?: number | null;
  semanas?: WeekPoint[];
  lastSync?: string | null;
  exemplo?: boolean;
  className?: string;
}

function haQuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

interface Marca {
  key: string;
  label: string;
  valor: number;
  tom: "anterior" | "meta";
}

// Card de destaque da página Patrocínios: uma pista com o vendido e o que está em negociação.
export function SponsorRevenueCard({ vendido, emNegociacao, negociosAbertos, abertosSemValor = 0, goals, anterior, anteriorTotal, semanas = [], lastSync, exemplo, className }: Props) {
  const { ativo: comparar, rotulo } = useCompare();
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const meta = goals.ampliada && goals.ampliada > 0 ? goals.ampliada : null;
  const falta = meta ? Math.max(meta - vendido, 0) : 0;
  const cobertura = meta && falta > 0 ? emNegociacao / falta : null;
  const potencial = vendido + emNegociacao;
  const mostraAnterior = comparar && anterior != null;
  const variacao = mostraAnterior && anterior > 0 ? (vendido - anterior) / anterior : null;

  const marcas: Marca[] = [
    ...(mostraAnterior ? [{ key: "mesma", label: `${rotulo} nesta data`, valor: anterior as number, tom: "anterior" as const }] : []),
    ...(comparar && anteriorTotal ? [{ key: "total", label: `${rotulo} fechou`, valor: anteriorTotal, tom: "anterior" as const }] : []),
    ...(goals.minima ? [{ key: "minima", label: "Meta mínima", valor: goals.minima, tom: "meta" as const }] : []),
    ...(goals.orcamento ? [{ key: "orcamento", label: "Orçamento", valor: goals.orcamento, tom: "meta" as const }] : []),
    ...(meta ? [{ key: "ampliada", label: "Meta ampliada", valor: meta, tom: "meta" as const }] : []),
  ].sort((a, b) => a.valor - b.valor);
  const escala = Math.max(potencial, ...marcas.map((m) => m.valor), 1) * 1.04;
  const pos = (v: number) => `${Math.min((v / escala) * 100, 100)}%`;
  // Rótulos que ficariam colados alternam em cima e embaixo da pista.
  let ultimo = -Infinity;
  let linha = 0;
  const marcasComLinha = marcas.map((m) => {
    const x = (m.valor / escala) * 100;
    linha = x - ultimo < 16 ? 1 - linha : 0;
    ultimo = x;
    return { ...m, linha };
  });

  const curva = semanas.map((w) => ({ receita: w.receita, anterior: comparar ? w.anterior : null }));
  const temCurva = curva.some((c) => (c.receita ?? 0) > 0) || (comparar && curva.some((c) => (c.anterior ?? 0) > 0));

  return (
    <Card className={cn("relative overflow-hidden border-[#0F1114] bg-[#0F1114] p-5 text-[#F5F2EB] dark:border-[#2d3a10] dark:shadow-glow sm:p-6", className)}>
      {/* Brilho de fundo, devagar */}
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(176,249,10,0.16),transparent_65%)] [animation:drift_18s_ease-in-out_infinite_alternate]" />

      <div className="relative flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#D6D2C8]">
        Receita de patrocínio
        <InfoTip title="Receita de patrocínio" text={REVENUE_INFO.card} className="text-[#D6D2C8]" />
        <div className="ml-auto flex items-center gap-2">
          {exemplo && <Chip variant="warn" className="px-2 py-0.5 text-[11px]">Dados de exemplo</Chip>}
          {lastSync && !exemplo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-[#9A9FA7]">
              <span className="sp-pulse h-1.5 w-1.5 rounded-full bg-[#B0F90A]" />
              Pipedrive {haQuanto(lastSync)}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="min-w-0">
          <div className="text-[clamp(38px,5vw,58px)] font-semibold leading-none tracking-[-0.04em]">
            <CountUp value={vendido} format={brl} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#9A9FA7]">
            {meta ? (
              vendido >= meta ? (
                <b className="font-semibold text-[#B0F90A]">Meta ampliada atingida</b>
              ) : (
                <span>
                  <b className="font-semibold text-[#F5F2EB]">{Math.round((vendido / meta) * 100)}%</b> da meta ampliada · faltam <b className="font-semibold text-[#B0F90A]">{brl(falta)}</b>
                </span>
              )
            ) : (
              <span>vendido nesta edição</span>
            )}
            {variacao != null && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", variacao >= 0 ? "bg-[#B0F90A]/15 text-[#B0F90A]" : "bg-warn/15 text-warn")}>
                {variacao >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(Math.round(variacao * 100))}% {variacao >= 0 ? "acima" : "abaixo"} de {rotulo} nesta data ({curto(anterior as number)})
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Pista: vendido sólido + em negociação listrado + marcas */}
      <div className="relative mt-7">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
          Vendido e em negociação
          <InfoTip title="Pista da receita" text={REVENUE_INFO.pista} className="text-[#9A9FA7]" />
        </div>
        {/* Faixa de 64px: rótulos em cima (0–18px), pista (24–40px), rótulos embaixo (46–64px). */}
        <div className="relative h-16">
          <div className="absolute inset-x-0 top-6 flex h-4 overflow-hidden rounded-full bg-[#22272E]">
            <div
              className="sp-glow h-full rounded-full bg-[#B0F90A] transition-[width] duration-[1300ms] ease-cupola"
              style={{ width: cheio ? pos(vendido) : "0%" }}
              title={`Vendido: ${brl(vendido)}`}
            />
            <div
              className="sp-stripes h-full rounded-r-full transition-[width] delay-300 duration-[1500ms] ease-cupola"
              style={{ width: cheio ? pos(emNegociacao) : "0%" }}
              title={`Em negociação: ${brl(emNegociacao)}`}
            />
          </div>
          {marcasComLinha.map((m) => {
            const x = Math.min((m.valor / escala) * 100, 100);
            const alinhamento = x > 82 ? "-translate-x-full" : x < 12 ? "" : "-translate-x-1/2";
            return (
              <div key={m.key} className="pointer-events-none absolute inset-y-0" style={{ left: `${x}%` }}>
                <span className={cn("absolute top-5 h-6 w-[2px] -translate-x-1/2 rounded-full", m.tom === "meta" ? "bg-[#F5F2EB]" : "bg-[#9A9FA7]")} />
                <span
                  className={cn("absolute whitespace-nowrap text-[10px] leading-[18px]", alinhamento, m.linha === 1 ? "top-0" : "top-[46px]", m.tom === "meta" ? "text-[#F5F2EB]" : "text-[#9A9FA7]")}
                >
                  {m.label} · <b className="font-semibold">{curto(m.valor)}</b>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#9A9FA7]">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-4 rounded-full bg-[#B0F90A]" /> Vendido <b className="font-semibold text-[#F5F2EB]">{curto(vendido)}</b>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="sp-stripes inline-block h-2 w-4 rounded-full" /> Em negociação <b className="font-semibold text-[#F5F2EB]">{curto(emNegociacao)}</b>
          </span>
        </div>
      </div>

      {/* Números de apoio */}
      <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
            Em negociação
            <InfoTip title="Em negociação" text={REVENUE_INFO.negociacao} className="text-[#9A9FA7]" />
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.02em]">
            <CountUp value={emNegociacao} format={brl} />
          </div>
          <div className="text-[11px] text-[#9A9FA7]">
            {negociosAbertos.toLocaleString("pt-BR")} negócios abertos
            {abertosSemValor > 0 && <span className="text-warn"> · {abertosSemValor.toLocaleString("pt-BR")} sem valor no Pipedrive</span>}
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
            Potencial
            <InfoTip title="Potencial" text={REVENUE_INFO.potencial} className="text-[#9A9FA7]" />
          </div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.02em]">
            <CountUp value={potencial} format={brl} />
          </div>
          <div className="text-[11px] text-[#9A9FA7]">se todos os abertos fecharem</div>
        </div>
        {cobertura != null ? (
          <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
              Cobertura
              <InfoTip title="Cobertura" text={REVENUE_INFO.cobertura} className="text-[#9A9FA7]" />
            </div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.02em]">{vezes(cobertura)}</div>
            <div className={cn("text-[11px]", cobertura >= 3 ? "text-[#B0F90A]" : "text-warn")}>{cobertura >= 3 ? "Funil suficiente" : "Faltam negócios"}</div>
          </div>
        ) : anteriorTotal ? (
          <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
              Para igualar {rotulo || "a edição anterior"}
              <InfoTip title="Para igualar a edição anterior" text={REVENUE_INFO.falta} className="text-[#9A9FA7]" />
            </div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.02em]">{brl(Math.max(anteriorTotal - vendido, 0))}</div>
            <div className="text-[11px] text-[#9A9FA7]">{rotulo} fechou em {curto(anteriorTotal)}</div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
