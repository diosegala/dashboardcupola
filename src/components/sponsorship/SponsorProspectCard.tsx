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
  etapas: "Quantos negócios abertos estão em cada etapa do funil agora. A barra é a parte dos negócios abertos que está naquela etapa.",
  conversao: "Quantos negócios chegaram até cada etapa, separados em quem seguiu (está nela, passou dela ou ganhou) e quem foi perdido nela. Ganho e perdido nunca se misturam.",
  tempo: "Há quantos dias, em geral, os negócios abertos estão na etapa em que estão (o valor do meio: metade está há menos tempo, metade há mais). O risco é o limite de dias da etapa no Pipedrive; sem limite, 14 dias. Passou do limite, a parte que passou fica laranja.",
  evolucao: "Valor em negociação dia a dia: a soma do valor dos produtos do evento nos negócios abertos naquele dia. Mostra a negociação subindo conforme os vendedores colocam o valor proposto no Pipedrive. Conta a partir do dia em que o histórico começou a ser guardado.",
  motivos: "Motivo de perda dos negócios perdidos nesta edição. Perda sem motivo não ensina nada à oferta: o guia de motivos de perda da CUPOLA pede motivo em toda perda e sem motivos genéricos.",
  responsavel: "Filtra a prospecção pelo responsável do negócio no Pipedrive (closer ou SDR dono do negócio).",
  abordadas: "Empresas com negócio no funil nesta edição: abertas agora, ganhas e perdidas no período da edição.",
  emNegociacao: "Negócios abertos no funil, com o valor dos negócios.",
  quentes: "Negócios abertos com a etiqueta de temperatura quente no Pipedrive.",
  ganhos: "Negócios ganhos nesta edição, com produto do evento. Conversão = ganhos ÷ negócios que saíram da primeira etapa.",
  perdidos: "Negócios perdidos nesta edição. Perda sem motivo não ensina nada à oferta.",
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          <MiniStat label="Ganhos" value={int(data.ganhos)} info={PROSPECT_INFO.ganhos} sub={data.conversao != null ? `Conversão de ${pct(data.conversao)}` : undefined} tone="ok" />
          <MiniStat
            label="Perdidos"
            value={int(data.perdidos)}
            info={PROSPECT_INFO.perdidos}
            sub={data.perdidos ? `${int(data.perdidosSemMotivo)} sem motivo` : undefined}
            tone={data.perdidosSemMotivo > 0 ? "warn" : undefined}
          />
        </div>

        {aba === "etapas" && (
          <div className="space-y-4">
            {data.etapas.length === 0 && <p className="text-sm text-muted-foreground">O funil do evento ainda não tem etapas lidas do Pipedrive.</p>}
            {data.etapas.map((e) => {
              const total = Math.max(data.emNegociacao, 1);
              return (
                <div key={e.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{e.nome}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {int(e.abertos)} <span className="font-normal text-muted-foreground">{e.abertos === 1 ? "negócio" : "negócios"}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="sp-grow h-full bg-primary" style={{ width: `${(e.abertos / total) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {pct(e.abertos / total)} dos negócios abertos{e.valor > 0 ? ` · ${brlShort(e.valor)} em negociação` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {aba === "conversao" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-3 rounded-full bg-data-blue" /> Seguiram
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-3 rounded-full bg-bad" /> Perdidos nesta etapa
              </span>
            </div>
            {data.etapas.map((e, i) => {
              const max = Math.max(...data.etapas.map((x) => x.chegaram), 1);
              const seguiram = Math.max(e.chegaram - e.perdidosAqui, 0);
              const anterior = i > 0 ? data.etapas[i - 1].chegaram : null;
              return (
                <div key={e.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{e.nome}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <b className="font-semibold text-foreground">{int(seguiram)}</b> seguiram
                      {e.perdidosAqui > 0 && (
                        <>
                          {" "}· <b className="font-semibold text-bad">{int(e.perdidosAqui)}</b> {e.perdidosAqui === 1 ? "perdido" : "perdidos"}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="sp-grow h-full bg-data-blue" style={{ width: `${(seguiram / max) * 100}%` }} />
                    <div className="sp-grow h-full bg-bad/80" style={{ width: `${(e.perdidosAqui / max) * 100}%` }} />
                  </div>
                  {anterior != null && anterior > 0 && <div className="text-[11px] text-muted-foreground">{pct(e.chegaram / anterior)} da etapa anterior chegou aqui</div>}
                </div>
              );
            })}
          </div>
        )}
        {aba === "tempo" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-3 rounded-full bg-primary" /> Dentro do limite
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-3 rounded-full bg-warn" /> Passou do limite
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-3 w-[2px] bg-foreground/60" /> Limite da etapa
              </span>
            </div>
            {data.etapas.filter((e) => e.medianaDias != null).length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio aberto no funil.</p>}
            {data.etapas
              .filter((e) => e.medianaDias != null)
              .map((e, _, lista) => {
                const dias = e.medianaDias as number;
                const max = Math.max(...lista.map((x) => Math.max(x.medianaDias as number, x.limiteDias)), 1);
                const dentro = Math.min(dias, e.limiteDias);
                const fora = Math.max(dias - e.limiteDias, 0);
                return (
                  <div key={e.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{e.nome}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {int(dias)} <span className="font-normal text-muted-foreground">{dias === 1 ? "dia" : "dias"}</span>
                      </span>
                    </div>
                    <div className="relative flex h-2 overflow-visible rounded-full bg-secondary">
                      <div className="sp-grow h-full rounded-l-full bg-primary" style={{ width: `${(dentro / max) * 100}%` }} />
                      <div className="sp-grow h-full rounded-r-full bg-warn" style={{ width: `${(fora / max) * 100}%` }} />
                      <span className="absolute -top-1 h-4 w-[2px] rounded-full bg-foreground/60" style={{ left: `calc(${(e.limiteDias / max) * 100}% - 1px)` }} />
                    </div>
                    <div className={e.travada ? "text-[11px] text-warn" : "text-[11px] text-muted-foreground"}>
                      {e.travada
                        ? `Parada demais: os negócios estão aqui há ${int(dias)} dias, em geral. O limite é ${int(e.limiteDias)}.`
                        : `Os negócios estão aqui há ${int(dias)} ${dias === 1 ? "dia" : "dias"}, em geral. O limite é ${int(e.limiteDias)}.`}{" "}
                      {int(e.abertos)} {e.abertos === 1 ? "negócio aberto" : "negócios abertos"}.
                    </div>
                  </div>
                );
              })}
          </div>
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
