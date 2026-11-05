import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/CountUp";
import { CompareLine } from "@/components/CompareLine";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { GoalRing } from "@/components/dashboard/CommercialOverview";
import type { SponsorshipGoals } from "@/lib/sponsorshipMetrics";
import { cn } from "@/lib/utils";

// Reais sem centavos.
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const vezes = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

export const REVENUE_INFO = {
  card: 'Soma dos produtos com o termo do evento e o código de patrocínio em negócios ganhos do funil do evento. Cobertura = valor em negociação ÷ quanto falta; abaixo de 3 vezes, faltam negócios.',
  negociacao: "Produtos do evento nos negócios abertos do funil. Negócio aberto ainda sem produto entra pelo valor do negócio.",
  cobertura: "Valor em negociação ÷ quanto falta para a meta ampliada. Abaixo de 3 vezes, o funil não tem negócios suficientes para chegar lá.",
  marcas: "Meta mínima (piso aceitável) e orçamento (receita prevista no DRE do evento), definidos no menu Metas.",
};

interface Props {
  vendido: number;
  emNegociacao: number;
  negociosAbertos: number;
  goals: SponsorshipGoals;
  anterior?: number | null;
  exemplo?: boolean;
  className?: string;
}

// Card de destaque da página Patrocínios, no modelo de "Meta de ingressos pagantes".
export function SponsorRevenueCard({ vendido, emNegociacao, negociosAbertos, goals, anterior, exemplo, className }: Props) {
  const meta = goals.ampliada && goals.ampliada > 0 ? goals.ampliada : null;
  const falta = meta ? Math.max(meta - vendido, 0) : 0;
  const cobertura = meta && falta > 0 ? emNegociacao / falta : null;
  const titulo = meta ? "Meta de receita de patrocínio" : "Receita de patrocínio";
  // Escala da barra: a maior entre meta ampliada e vendido, para as marcas caberem.
  const escala = Math.max(meta ?? 0, goals.minima ?? 0, goals.orcamento ?? 0, vendido, 1);
  const marcas = [
    goals.orcamento ? { label: "Orçamento", valor: goals.orcamento } : null,
    goals.minima ? { label: "Meta mínima", valor: goals.minima } : null,
  ].filter(Boolean) as { label: string; valor: number }[];

  return (
    <Card className={cn("flex flex-col gap-5 border-[#0F1114] bg-[#0F1114] p-5 text-[#F5F2EB] dark:border-[#2d3a10] dark:shadow-glow", className)}>
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#D6D2C8]">
        {titulo}
        <InfoTip title={titulo} text={REVENUE_INFO.card} className="text-[#D6D2C8]" />
        {exemplo && <Chip variant="warn" className="ml-auto px-2 py-0.5 text-[11px]">Dados de exemplo</Chip>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex items-center gap-5">
          {meta && <GoalRing progress={Math.min(vendido / meta, 1)} />}
          <div className="min-w-0">
            <div className="text-[clamp(30px,3.6vw,42px)] font-semibold leading-none tracking-[-0.035em]">
              <CountUp value={vendido} format={brl} />
            </div>
            {meta && <div className="mt-1 text-sm text-[#9A9FA7]">de {brl(meta)}</div>}
            <p className="mt-2 text-xs text-[#9A9FA7]">
              {meta ? (
                vendido >= meta ? (
                  <b className="font-semibold text-[#B0F90A]">Meta ampliada atingida</b>
                ) : (
                  <>
                    Faltam <b className="font-semibold text-[#B0F90A]">{brl(falta)}</b> para a meta ampliada
                  </>
                )
              ) : (
                <>Vendido em negócios ganhos desta edição</>
              )}
            </p>
            <CompareLine className="mt-1.5" escuro anterior={anterior} atual={vendido} formato={brl} />
          </div>
        </div>

        <div className="space-y-4">
          {(meta || marcas.length > 0) && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
                Vendido contra as metas
                <InfoTip title="Marcas da meta" text={REVENUE_INFO.marcas} className="text-[#9A9FA7]" />
              </div>
              <div className="relative h-2 rounded-full bg-[#2A2F36]">
                <div className="h-full rounded-full bg-[#B0F90A] transition-[width] duration-[1100ms] ease-cupola" style={{ width: `${Math.min(vendido / escala, 1) * 100}%` }} />
                {marcas.map((m) => (
                  <span key={m.label} className="absolute -top-[4px] h-[16px] w-[2px] rounded-full bg-[#F5F2EB]/70" style={{ left: `calc(${(m.valor / escala) * 100}% - 1px)` }} title={`${m.label}: ${brl(m.valor)}`} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#9A9FA7]">
                {marcas.map((m) => (
                  <span key={m.label}>
                    {m.label} <b className="font-semibold text-[#D6D2C8]">{brl(m.valor)}</b>
                    {vendido >= m.valor && <span className="ml-1 text-[#B0F90A]">✓</span>}
                  </span>
                ))}
                {meta && (
                  <span>
                    Meta ampliada <b className="font-semibold text-[#D6D2C8]">{brl(meta)}</b>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#1A1E23] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
                Em negociação
                <InfoTip title="Em negociação" text={REVENUE_INFO.negociacao} className="text-[#9A9FA7]" />
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{brl(emNegociacao)}</div>
              <div className="text-[11px] text-[#9A9FA7]">{negociosAbertos.toLocaleString("pt-BR")} negócios abertos</div>
            </div>
            {cobertura !== null && (
              <div className="rounded-2xl bg-[#1A1E23] px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
                  Cobertura
                  <InfoTip title="Cobertura" text={REVENUE_INFO.cobertura} className="text-[#9A9FA7]" />
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em]">{vezes(cobertura)}</div>
                <div className={cn("text-[11px]", cobertura >= 3 ? "text-[#B0F90A]" : "text-warn")}>{cobertura >= 3 ? "Funil suficiente" : "Faltam negócios"}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
