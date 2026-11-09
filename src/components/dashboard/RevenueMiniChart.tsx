import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { rotuloMes, type TotalMonth } from "@/lib/monthlyRevenue";

export type FonteReceita = "ingressos" | "patrocinios" | "total";

const COR_INGRESSOS = "hsl(var(--chart-1))";
const COR_PATROCINIOS = "hsl(var(--chart-2))";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Mini evolução mês a mês do card Receita acumulada. No Total, cada barra é dividida entre ingressos e patrocínios.
export function RevenueMiniChart({ meses, fonte }: { meses: TotalMonth[]; fonte: FonteReceita }) {
  const valor = (m: TotalMonth) => (fonte === "ingressos" ? m.ingressos : fonte === "patrocinios" ? m.patrocinios : m.total);
  // Da primeira venda da opção escolhida até o mês atual; meses futuros ainda não têm o que mostrar.
  const inicio = meses.findIndex((m) => valor(m) > 0);
  let acc = 0;
  const dados = (inicio < 0 ? [] : meses.slice(inicio))
    .filter((m) => !m.futuro || valor(m) > 0)
    .map((m) => {
      acc += valor(m);
      return { ...m, nome: rotuloMes(m.mes), valorFonte: valor(m), acumuladoFonte: acc };
    });
  if (!dados.length) return <p className="text-xs text-muted-foreground">Sem vendas para mostrar a evolução.</p>;
  const parcial = dados.some((d) => d.parcial);

  return (
    <div>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={dados} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
          <XAxis dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" height={16} className="fill-muted-foreground" />
          <Tooltip cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }} content={<Dica fonte={fonte} />} />
          {fonte !== "patrocinios" && (
            <Bar dataKey="ingressos" stackId="receita" fill={COR_INGRESSOS} isAnimationActive={false} maxBarSize={22}>
              {dados.map((d) => <Cell key={d.mes} fillOpacity={d.parcial ? 0.5 : 0.9} />)}
            </Bar>
          )}
          {fonte !== "ingressos" && (
            <Bar dataKey="patrocinios" stackId="receita" fill={COR_PATROCINIOS} isAnimationActive={false} maxBarSize={22}>
              {dados.map((d) => <Cell key={d.mes} fillOpacity={d.parcial ? 0.5 : 0.9} />)}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {fonte !== "patrocinios" && <Legenda cor={COR_INGRESSOS} texto="Ingressos" />}
        {fonte !== "ingressos" && <Legenda cor={COR_PATROCINIOS} texto="Patrocínios" />}
        {parcial && <span>Barra mais clara: mês parcial</span>}
      </div>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-sm" style={{ background: cor }} />
      {texto}
    </span>
  );
}

function Dica({ active, payload, fonte }: any) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload as TotalMonth & { valorFonte: number; acumuladoFonte: number };
  return (
    <div className="min-w-[170px] rounded-[10px] border border-line-strong bg-card px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-semibold">{rotuloMes(m.mes, true)}{m.parcial && <span className="ml-1 font-normal text-muted-foreground">(parcial)</span>}</div>
      {fonte === "total" && (
        <>
          <div className="flex justify-between gap-4 text-muted-foreground"><span>Ingressos</span><span className="tabular-nums">{brl(m.ingressos)}</span></div>
          <div className="flex justify-between gap-4 text-muted-foreground"><span>Patrocínios</span><span className="tabular-nums">{brl(m.patrocinios)}</span></div>
        </>
      )}
      <div className="flex justify-between gap-4"><span>No mês</span><b className="tabular-nums">{brl(m.valorFonte)}</b></div>
      <div className="mt-1 flex justify-between gap-4 border-t pt-1"><span>Acumulado</span><b className="tabular-nums">{brl(m.acumuladoFonte)}</b></div>
    </div>
  );
}
