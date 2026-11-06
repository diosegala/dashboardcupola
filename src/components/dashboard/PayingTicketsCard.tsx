import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/CountUp";
import { InfoTip } from "@/components/InfoTip";
import { METRIC_INFO } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

interface Props {
  sympla: number;
  faturados: number;
  // Faturamento em andamento: ingressos de negócios abertos no CRM (negociação, fechamento). Não contam na meta;
  // quando o negócio é ganho, passam para faturados. Só o faturado interno passa pelo CRM, a Sympla não.
  emNegociacao: number;
  meta: number | null;
  anterior?: number | null;
  rotuloAnterior: string;
  extra?: React.ReactNode;
  className?: string;
}

// Ingressos pagantes no visual do card de Receita de patrocínio: número grande, pista com Sympla, faturados e
// em negociação, marcas da meta e do ano anterior, e os números de apoio embaixo.
export function PayingTicketsCard({ sympla, faturados, emNegociacao, meta, anterior, rotuloAnterior, extra, className }: Props) {
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCheio(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pagantes = sympla + faturados;
  const falta = meta ? Math.max(meta - pagantes, 0) : 0;
  const variacao = anterior != null && anterior > 0 ? (pagantes - anterior) / anterior : null;
  const marcas = [
    ...(anterior != null ? [{ key: "anterior", label: `${rotuloAnterior} nesta data`, valor: anterior, meta: false }] : []),
    ...(meta ? [{ key: "meta", label: "Meta", valor: meta, meta: true }] : []),
  ];
  // Sem meta, a pista vai até o maior número que aparece; com meta, até a meta (a pista mostra o caminho até ela).
  const escala = Math.max(meta ?? 0, pagantes + emNegociacao, anterior ?? 0, 1) * (meta ? 1 : 1.04);
  const pos = (v: number) => `${Math.min((v / escala) * 100, 100)}%`;

  return (
    <Card className={cn("relative overflow-hidden border-[#0F1114] bg-[#0F1114] p-5 text-[#F5F2EB] dark:border-[#2d3a10] dark:shadow-glow sm:p-6", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(176,249,10,0.16),transparent_65%)] [animation:drift_18s_ease-in-out_infinite_alternate]" />

      <div className="relative flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#D6D2C8]">
        Ingressos pagantes
        <InfoTip title="Ingressos pagantes" text={METRIC_INFO["Ingressos pagantes"]} className="text-[#D6D2C8]" />
        {extra}
      </div>

      <div className="relative mt-4">
        <div className="text-[clamp(38px,5vw,58px)] font-semibold leading-none tracking-[-0.04em]">
          <CountUp value={pagantes} format={int} />
          {meta && <small className="ml-2 text-base font-medium tracking-normal text-[#9A9FA7]">de {int(meta)}</small>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#9A9FA7]">
          {meta ? (
            pagantes >= meta ? (
              <b className="font-semibold text-[#B0F90A]">Meta atingida</b>
            ) : (
              <span>
                <b className="font-semibold text-[#F5F2EB]">{Math.round((pagantes / meta) * 100)}%</b> da meta · faltam <b className="font-semibold text-[#B0F90A]">{int(falta)}</b>
              </span>
            )
          ) : (
            <span>pagos na Sympla e faturados pelo comercial</span>
          )}
          {variacao != null && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", variacao >= 0 ? "bg-[#B0F90A]/15 text-[#B0F90A]" : "bg-warn/15 text-warn")}>
              {variacao >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(Math.round(variacao * 100))}% {variacao >= 0 ? "acima" : "abaixo"} de {rotuloAnterior} nesta data ({int(anterior as number)})
            </span>
          )}
        </div>
      </div>

      {/* Pista: Sympla sólido, faturados em outro tom, em negociação listrado, e as marcas. */}
      <div className="relative mt-7">
        <div className="relative h-14">
          <div className="absolute inset-x-0 top-1 flex h-4 overflow-hidden rounded-full bg-[#22272E]">
            <div className="sp-glow h-full bg-[#B0F90A] transition-[width] duration-[1300ms] ease-cupola" style={{ width: cheio ? pos(sympla) : "0%" }} title={`Sympla: ${int(sympla)}`} />
            {faturados > 0 && (
              <div className="h-full bg-[#F5F2EB] transition-[width] delay-150 duration-[1300ms] ease-cupola" style={{ width: cheio ? pos(faturados) : "0%" }} title={`Faturados internamente: ${int(faturados)}`} />
            )}
            {emNegociacao > 0 && (
              <div className="sp-stripes h-full rounded-r-full transition-[width] delay-300 duration-[1500ms] ease-cupola" style={{ width: cheio ? pos(emNegociacao) : "0%" }} title={`Faturamento em andamento: ${int(emNegociacao)}`} />
            )}
          </div>
          {marcas.map((m) => {
            const x = Math.min((m.valor / escala) * 100, 100);
            const alinhamento = x > 82 ? "-translate-x-full" : x < 12 ? "" : "-translate-x-1/2";
            return (
              <div key={m.key} className="pointer-events-none absolute inset-y-0" style={{ left: `${x}%` }}>
                <span className={cn("absolute top-0 h-6 w-[2px] -translate-x-1/2 rounded-full", m.meta ? "bg-[#F5F2EB]" : "bg-[#9A9FA7]")} />
                <span className={cn("absolute top-[30px] whitespace-nowrap text-[10px] leading-[18px]", alinhamento, m.meta ? "text-[#F5F2EB]" : "text-[#9A9FA7]")}>
                  {m.label} · <b className="font-semibold">{int(m.valor)}</b>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Números de apoio */}
      <div className="relative mt-3 grid gap-2 sm:grid-cols-3">
        <Apoio cor="bg-[#B0F90A]" titulo="Pagos na Sympla" valor={sympla} rodape="vendas diretas no site" />
        <Apoio cor="bg-[#F5F2EB]" titulo="Faturados internamente" valor={faturados} info={METRIC_INFO["Faturados internamente"]} rodape="negócios ganhos no CRM" />
        <Apoio
          listrado
          titulo="Faturamento em andamento"
          valor={emNegociacao}
          info="Ingressos de negócios ainda abertos no funil de ingressos do Pipedrive (negociação, fechamento). Não contam na meta. Quando o negócio é ganho, os ingressos passam para Faturados internamente."
          rodape="abertos no CRM · entram quando ganhos"
        />
      </div>
    </Card>
  );
}

function Apoio({ titulo, valor, cor, listrado, info, rodape }: { titulo: string; valor: number; cor?: string; listrado?: boolean; info?: string; rodape?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-1.5 text-[11px] text-[#9A9FA7]">
        <i className={cn("inline-block h-2 w-4 rounded-full", listrado ? "sp-stripes" : cor)} />
        {titulo}
        {info && <InfoTip title={titulo} text={info} className="text-[#9A9FA7]" />}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.02em]">
        <CountUp value={valor} format={int} />
      </div>
      {rodape && <div className="text-[11px] text-[#9A9FA7]">{rodape}</div>}
    </div>
  );
}
