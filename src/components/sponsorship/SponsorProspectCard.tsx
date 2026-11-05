import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTip } from "@/components/InfoTip";
import type { FieldStatus, Prospect, ValueEvolution } from "@/lib/sponsorshipExtra";
import { CardTabs } from "./CardTabs";
import { BarList, CrmWarning, DetailsToggle, MiniStat, brlShort, int, pct } from "./parts";

export const PROSPECT_INFO = {
  card: "Empresas e valor em cada etapa do funil do evento, na ordem do Pipedrive. Conversão = ganhos ÷ negócios que saíram da primeira etapa. Etapa travada = mediana de dias acima do limite da etapa (sem limite, 14 dias).",
  etapas: "Negócios abertos em cada etapa do funil e o valor deles. Ganhos e perdidos vêm do status do negócio.",
  conversao: "Quantos negócios chegaram até cada etapa (estão nela ou já passaram por ela). Perdidos contam até a etapa em que pararam.",
  tempo: "Mediana de dias que os negócios abertos estão parados na etapa atual, desde a última mudança de etapa. Acima do limite da etapa (sem limite, 14 dias), a etapa fica travada.",
  evolucao: "Valor em negociação dia a dia: a soma do valor dos produtos do evento nos negócios abertos naquele dia. Mostra a negociação subindo conforme os vendedores colocam o valor proposto no Pipedrive. Conta a partir do dia em que o histórico começou a ser guardado.",
  motivos: "Motivo de perda dos negócios perdidos nesta edição. Perda sem motivo não ensina nada à oferta: o guia de motivos de perda da CUPOLA pede motivo em toda perda e sem motivos genéricos.",
  responsavel: "Filtra a prospecção pelo responsável do negócio no Pipedrive (closer ou SDR dono do negócio).",
  abordadas: "Empresas com negócio no funil nesta edição: abertas agora, ganhas e perdidas no período da edição.",
  emNegociacao: "Negócios abertos no funil, com o valor dos negócios.",
  quentes: "Negócios abertos com a etiqueta de temperatura quente no Pipedrive.",
  ganhosPerdidos: "Negócios ganhos e perdidos nesta edição.",
  conversaoStat: "Ganhos ÷ negócios que saíram da primeira etapa.",
};

const TODOS = "__todos__";

interface Props {
  data: Prospect;
  responsavel: string | null;
  onResponsavel: (v: string | null) => void;
  metaAbordagens: number | null;
  origem?: FieldStatus;
  // Negócios abertos com produto do evento em R$ 0 no Pipedrive.
  abertosSemValor?: number;
  evolucao?: ValueEvolution;
  className?: string;
}

export function SponsorProspectCard({ data, responsavel, onResponsavel, metaAbordagens, origem, abertosSemValor = 0, evolucao, className }: Props) {
  const [aba, setAba] = useState<"etapas" | "conversao" | "tempo" | "evolucao" | "motivos">("etapas");
  const [verMudancas, setVerMudancas] = useState(false);
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const totalPerdidos = data.perdidos;
  const outros = data.motivos.filter((m) => /^outros/i.test(m.motivo)).reduce((t, m) => t + m.negocios, 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Prospecção <InfoTip title="Prospecção" text={PROSPECT_INFO.card} />
          </CardTitle>
          <div className="mt-2 flex items-center gap-1.5">
            <Select value={responsavel ?? TODOS} onValueChange={(v) => onResponsavel(v === TODOS ? null : v)}>
              <SelectTrigger className="h-8 w-[220px] rounded-full text-xs" aria-label="Responsável">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
                {data.responsaveis.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InfoTip title="Responsável" text={PROSPECT_INFO.responsavel} />
          </div>
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "etapas", label: "Etapas", info: PROSPECT_INFO.etapas },
            { value: "conversao", label: "Conversão", info: PROSPECT_INFO.conversao },
            { value: "tempo", label: "Tempo por etapa", info: PROSPECT_INFO.tempo },
            { value: "evolucao", label: "Evolução", info: PROSPECT_INFO.evolucao },
            { value: "motivos", label: "Motivos de perda", info: PROSPECT_INFO.motivos },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat
            label="Abordadas"
            value={int(data.abordadas)}
            info={PROSPECT_INFO.abordadas}
            sub={metaAbordagens ? `${pct(data.abordadas / metaAbordagens)} da meta de ${int(metaAbordagens)}` : undefined}
          />
          <MiniStat label="Em negociação" value={int(data.emNegociacao)} info={PROSPECT_INFO.emNegociacao} sub={brlShort(data.valorAberto)} />
          <MiniStat
            label="Quentes"
            value={data.quentes == null ? "—" : int(data.quentes)}
            info={PROSPECT_INFO.quentes}
            sub={data.quentes == null ? "Sem etiqueta de temperatura" : undefined}
            tone={data.quentes == null ? "warn" : undefined}
          />
          <MiniStat
            label="Ganhos e perdidos"
            value={`${int(data.ganhos)} · ${int(data.perdidos)}`}
            info={PROSPECT_INFO.ganhosPerdidos}
            sub={data.conversao != null ? `Conversão de ${pct(data.conversao)}` : undefined}
          />
        </div>

        {aba === "etapas" && (
          <BarList
            items={data.etapas.map((e) => ({ key: String(e.id), label: e.nome, value: e.abertos, text: int(e.abertos), sub: e.abertos ? brlShort(e.valor) : undefined }))}
            empty="O funil do evento ainda não tem etapas lidas do Pipedrive."
          />
        )}
        {aba === "conversao" && (
          <BarList
            color="bg-data-blue"
            items={data.etapas.map((e, i) => ({
              key: String(e.id),
              label: e.nome,
              value: e.chegaram,
              text: int(e.chegaram),
              sub: i > 0 && data.etapas[i - 1].chegaram > 0 ? `${pct(e.chegaram / data.etapas[i - 1].chegaram)} da etapa anterior` : undefined,
            }))}
          />
        )}
        {aba === "tempo" && (
          <BarList
            items={data.etapas
              .filter((e) => e.medianaDias != null)
              .map((e) => ({
                key: String(e.id),
                label: e.nome,
                value: e.medianaDias as number,
                text: `${int(e.medianaDias as number)} dias`,
                sub: `${e.travada ? "Travada: " : ""}limite de ${int(e.limiteDias)} dias · ${int(e.abertos)} abertos`,
                tone: e.travada ? ("warn" as const) : undefined,
              }))}
            empty="Nenhum negócio aberto no funil."
          />
        )}
        {aba === "evolucao" && (
          <div className="space-y-3">
            {!evolucao || evolucao.serie.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                O histórico do valor começou a ser guardado agora. A linha aparece a partir do segundo dia, e cada mudança de valor no Pipedrive passa a entrar aqui.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={evolucao.serie.map((p) => ({ ...p, label: ddmm(p.dia) }))} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} width={78} tickFormatter={(v) => brlShort(v)} className="fill-muted-foreground" />
                  <Tooltip
                    formatter={(v: number) => [brlShort(v), "Em negociação"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line-strong))", borderRadius: 10, fontSize: 12 }}
                  />
                  <Line dataKey="valor" type="stepAfter" stroke="hsl(var(--data-blue))" strokeWidth={2.25} dot={false} animationDuration={800} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {evolucao && evolucao.mudancas.length > 0 && (
              <>
                <div className="flex justify-end">
                  <DetailsToggle open={verMudancas} onToggle={() => setVerMudancas((v) => !v)} count={evolucao.mudancas.length} />
                </div>
                {verMudancas && (
                  <div className="max-h-[260px] overflow-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-[11px] text-muted-foreground">
                          {[
                            ["Data", "Dia em que a sincronização percebeu a mudança de valor no Pipedrive."],
                            ["Empresa", "Empresa do negócio."],
                            ["De", "Valor dos produtos do evento no negócio antes da mudança."],
                            ["Para", "Valor depois da mudança."],
                          ].map(([t, i]) => (
                            <th key={t} className="px-2 pb-2 font-medium first:pl-0">
                              <span className="inline-flex items-center gap-1.5">
                                {t}
                                <InfoTip title={t} text={i} />
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evolucao.mudancas.map((c, i) => (
                          <tr key={`${c.dealId}-${i}`} className="border-t">
                            <td className="py-2 pr-2 tabular-nums text-muted-foreground">{ddmm(c.em)}</td>
                            <td className="px-2 py-2 font-medium">{c.empresa}</td>
                            <td className="px-2 py-2 tabular-nums">{brlShort(c.de)}</td>
                            <td className="px-2 py-2 font-semibold tabular-nums">{brlShort(c.para)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {aba === "motivos" && (
          <BarList
            color="bg-bad"
            items={[
              ...data.motivos.slice(0, 10).map((m) => ({ key: m.motivo, label: m.motivo, value: m.negocios, text: int(m.negocios), sub: totalPerdidos ? pct(m.negocios / totalPerdidos) : undefined })),
              ...(data.perdidosSemMotivo
                ? [{ key: "__sem", label: "Sem motivo", value: data.perdidosSemMotivo, text: int(data.perdidosSemMotivo), sub: pct(data.perdidosSemMotivo / Math.max(totalPerdidos, 1)), tone: "warn" as const }]
                : []),
            ]}
            empty="Nenhum negócio perdido nesta edição."
          />
        )}

        <CrmWarning
          fields={aba === "etapas" ? [origem?.state === "ok" ? undefined : origem] : []}
          notes={[
            abertosSemValor > 0 &&
              `Valor em negociação: ${int(abertosSemValor)} ${abertosSemValor === 1 ? "negócio aberto está" : "negócios abertos estão"} com a cota em R$ 0 no Pipedrive. Colocar o valor proposto no produto do negócio para o valor em negociação e a cobertura ficarem certos.`,
            data.quentes == null && "Temperatura: a conta não tem as etiquetas Frio, Morno e Quente. Criar as etiquetas de negócio no Pipedrive e marcar os negócios.",
            aba === "motivos" && data.perdidosSemMotivo > 0 && `Motivos de perda: ${int(data.perdidosSemMotivo)} de ${int(totalPerdidos)} perdidos estão sem motivo. Registrar o motivo em toda perda.`,
            aba === "motivos" && outros > 0 && `Motivos de perda: ${int(outros)} perdidos usam "Outros". Revisar a lista de motivos para diminuir o genérico.`,
            aba === "tempo" && "Tempo por etapa: conta desde a última mudança de etapa do negócio. O histórico completo de etapas começa a contar com o webhook do Pipedrive ligado.",
          ]}
        />
      </CardContent>
    </Card>
  );
}
