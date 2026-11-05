import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import type { FieldStatus, Receipts } from "@/lib/sponsorshipExtra";
import { CardTabs } from "./CardTabs";
import { BarList, CrmWarning, MiniStat, brlShort, pct } from "./parts";

export const RECEIPTS_INFO = {
  card: "Parcelas do negócio a partir do 1º vencimento. Permuta fica fora. Com parcelas lançadas no Pipedrive, valem as parcelas; sem elas, o número de parcelas e o 1º vencimento dos campos do negócio.",
  porMes: "Caixa de patrocínio que entra em cada mês.",
  porAno: "Caixa de patrocínio que entra em cada ano, contra a meta de recebimento do ano (menu Metas).",
  depois: "Quanto vence depois do mês do evento: caixa que entra quando o evento já passou.",
  semCondicao: "Vendas sem parcelas lançadas e sem número de parcelas ou 1º vencimento: não dá para saber quando o dinheiro entra.",
  permuta: "Vendas pagas em permuta: contam como cota vendida, mas não entram no caixa.",
};

const mesLabel = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;
const eixo = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(Math.round(n)));

interface Props {
  data: Receipts;
  vendido: number;
  metaPorAno: Record<number, number>;
  campos: (FieldStatus | undefined)[];
  semParcelasNoCrm: boolean;
  className?: string;
}

export function SponsorReceiptsCard({ data, vendido, metaPorAno, campos, semParcelasNoCrm, className }: Props) {
  const [aba, setAba] = useState<"mes" | "ano" | "depois">("mes");
  const total = data.porMes.reduce((t, m) => t + m.valor, 0);
  const semDados = data.fonte === "nenhuma";

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Recebimentos <InfoTip title="Recebimentos" text={RECEIPTS_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {semDados ? "Quando o dinheiro das vendas entra" : `${brlShort(total)} programados · ${pct(vendido > 0 ? total / vendido : 0)} do vendido`}
          </p>
        </div>
        {!semDados && (
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "mes", label: "Por mês", info: RECEIPTS_INFO.porMes },
            { value: "ano", label: "Por ano", info: RECEIPTS_INFO.porAno },
            { value: "depois", label: "Depois do evento", info: RECEIPTS_INFO.depois },
          ]}
        />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {semDados && (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Ainda não há datas de pagamento das vendas. Quando o painel financeiro estiver ligado, o calendário de recebimentos aparece aqui.
          </p>
        )}
        {!semDados && aba === "mes" && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.porMes.map((m) => ({ ...m, label: mesLabel(m.mes) }))} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={eixo} className="fill-muted-foreground" />
              <Tooltip
                formatter={(v: number) => [brlShort(v), "Recebimento"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 }}
              />
              <Bar dataKey="valor" fill="hsl(var(--data-blue))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!semDados && aba === "ano" && (
          <BarList
            color="bg-data-blue"
            items={data.porAno.map((a) => ({
              key: String(a.ano),
              label: String(a.ano),
              value: a.valor,
              text: brlShort(a.valor),
              sub: metaPorAno[a.ano] ? `${pct(a.valor / metaPorAno[a.ano])} da meta de ${brlShort(metaPorAno[a.ano])}` : undefined,
            }))}
          />
        )}
        {!semDados && aba === "depois" && (
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Depois do evento" value={brlShort(data.depoisDoEvento)} info={RECEIPTS_INFO.depois} sub={total > 0 ? `${pct(data.depoisDoEvento / total)} dos recebimentos` : undefined} tone={data.depoisDoEvento > 0 ? "warn" : undefined} />
            <MiniStat label="Até o evento" value={brlShort(total - data.depoisDoEvento)} info={RECEIPTS_INFO.porMes} />
          </div>
        )}
        {!semDados && (data.semCondicao > 0 || data.permuta > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {data.semCondicao > 0 && <MiniStat label="Vendas sem data de pagamento" value={brlShort(data.semCondicao)} info={RECEIPTS_INFO.semCondicao} tone="warn" sub="Não entram no calendário acima" />}
            {data.permuta > 0 && <MiniStat label="Permuta" value={brlShort(data.permuta)} info={RECEIPTS_INFO.permuta} sub="Fora dos recebimentos" />}
          </div>
        )}
        <CrmWarning
          fields={campos.filter((c) => c && c.state !== "ok")}
          notes={[semParcelasNoCrm && "Parcelas: nenhum negócio ganho desta edição tem parcelas lançadas no Pipedrive. Lançar as parcelas no negócio ou preencher Número de parcelas e 1º vencimento."]}
        />
      </CardContent>
    </Card>
  );
}
