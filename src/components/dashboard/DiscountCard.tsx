import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { Chip } from "@/components/Chip";
import { useEvent } from "@/hooks/useEvent";
import { useEventBatches } from "@/hooks/useEventBatches";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { descontoPonderado, descontoSimples, resumoDesconto, taxaDaSympla, type Soma, type VendaDesconto } from "@/lib/lotPricing";
import { canalDe } from "@/lib/salesChannel";
import { lotesParaLista } from "@/lib/batches";
import { loteVigente } from "@/lib/batchCalendar";
import { alertasCrmDesconto, foraDoDesconto } from "@/lib/discountExclusions";
import { cn } from "@/lib/utils";

const TITULO = "Desconto médio";
const pctTxt = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const plural = (n: number, singular: string, plural: string) => `${int(n)} ${n === 1 ? singular : plural}`;

// A conta fica disponível em todo número calculado: ingressos, tabela e valor realizado.
function Conta({ soma, children, className }: { soma: Soma; children: ReactNode; className?: string }) {
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <div tabIndex={0} className={cn("cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" collisionPadding={12} className="max-w-[280px] space-y-1 text-left">
        <b className="mb-1 block">Como chegamos neste número</b>
        <span className="block">{plural(soma.ingressos, "ingresso", "ingressos")}</span>
        <span className="block">Valor de tabela: {brl(soma.cheio)}</span>
        <span className="block">Valor realizado: {brl(soma.pago)}</span>
        <span className="block">Desconto: {brl(soma.cheio - soma.pago)}</span>
        <span className="block pt-1 text-xs text-muted-foreground">1 − valor realizado ÷ valor de tabela</span>
      </TooltipContent>
    </Tooltip>
  );
}

function TituloAba({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
      {titulo}
      <InfoTip title={titulo} text={texto} contentClassName="max-h-[var(--radix-tooltip-content-available-height)] overflow-y-auto" />
    </div>
  );
}

function Fonte({ nome, soma }: { nome: string; soma: Soma }) {
  return (
    <Conta soma={soma} className="space-y-1 rounded-2xl bg-secondary/60 p-4">
      <div className="text-xs font-semibold text-muted-foreground">{nome}</div>
      <div className="text-2xl font-semibold tabular-nums">{pctTxt(descontoPonderado(soma))}</div>
      <div className="text-sm">{brl(soma.cheio - soma.pago)}</div>
      <div className="text-xs text-muted-foreground">{plural(soma.vendas, "venda", "vendas")}</div>
    </Conta>
  );
}

function LinhaDesconto({ nome, soma, vigente = false }: { nome: string; soma: Soma; vigente?: boolean }) {
  return (
    <Conta soma={soma} className="grid gap-2 border-t border-border px-2 py-3 text-sm first:border-t-0 sm:grid-cols-[minmax(150px,1fr)_100px_110px_130px] sm:items-center">
      <span className="flex items-center gap-2 font-medium">{nome}{vigente && <Chip variant="paid" dot={false} className="px-2 py-0.5 text-[10px]">Vigente</Chip>}</span>
      <span className="font-semibold tabular-nums sm:text-right">{pctTxt(descontoPonderado(soma))}</span>
      <span className="text-xs text-muted-foreground sm:text-right">{plural(soma.ingressos, "ingresso", "ingressos")}</span>
      <span className="tabular-nums sm:text-right">{brl(soma.cheio - soma.pago)}</span>
    </Conta>
  );
}

function RodapeTaxa({ taxa, base, percentual, semValor }: { taxa: number; base: number; percentual: number | null; semValor: number }) {
  if (base <= 0) return <p className="text-xs text-muted-foreground">Nenhuma taxa da Sympla identificada neste período. Negócios faturados não têm essa taxa.</p>;
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="w-fit cursor-help space-y-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="text-xs font-medium text-muted-foreground">Taxa da Sympla · custo de plataforma, não desconto</p>
          <p className="text-sm font-semibold">{brl(taxa)}</p>
          <p className="text-xs text-muted-foreground">{pctTxt(percentual)} do valor pago pelos clientes</p>
          <p className="text-xs text-muted-foreground">Negócios faturados não têm essa taxa.</p>
          {semValor > 0 && <p className="text-xs text-muted-foreground">{plural(semValor, "ingresso sem taxa confirmada", "ingressos sem taxa confirmada")}</p>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] space-y-1 text-left">
        <b className="mb-1 block">Taxa em separado</b>
        <span className="block">Valor pago pelos clientes: {brl(base)}</span>
        <span className="block">Valor líquido depois da taxa: {brl(base - taxa)}</span>
        <span className="block">Custo de plataforma: {brl(taxa)}</span>
        <span className="block pt-1 text-xs text-muted-foreground">Valor do comprador − valor líquido</span>
      </TooltipContent>
    </Tooltip>
  );
}

function TooltipTempo({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const bloco = (titulo: string, s: Soma) => (
    <div className="mt-2 space-y-0.5" key={titulo}>
      <b>{titulo}: {pctTxt(descontoPonderado(s))}</b>
      <span className="block">{plural(s.ingressos, "ingresso", "ingressos")}</span>
      <span className="block">Tabela: {brl(s.cheio)}</span>
      <span className="block">Realizado: {brl(s.pago)}</span>
    </div>
  );
  return <div className="rounded-xl border bg-popover p-3 text-xs text-popover-foreground shadow-md"><b>{rotuloMes(d.mes)}</b>{bloco("No mês", d.soma)}{bloco("Acumulado", d.acumuladaSoma)}</div>;
}

// Desconto frente à tabela oficial: cinco leituras independentes, todas no período filtrado no topo.
export function DiscountCard({ tickets, className }: { tickets: Ticket[]; className?: string }) {
  const { event } = useEvent();
  const { data: lotes = [], isLoading: carregandoLotes } = useEventBatches();
  const [aba, setAba] = useState("resumo");
  // Valor do comprador por ingresso (só esse campo, liberado para todo o painel).
  const precos = useQuery({
    queryKey: ["valor-comprador", event.sympla_event_id],
    enabled: !!event.sympla_event_id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_buyer_prices", { p_event_id: event.sympla_event_id });
      if (error) throw error;
      return new Map<string, number>(((data ?? []) as any[]).filter((r) => r.ticket_sale_price != null).map((r) => [String(r.sympla_order_id), Number(r.ticket_sale_price)]));
    },
  });
  const preVenda = useQuery({
    queryKey: ["preco-pre-venda", event.id],
    enabled: !!event.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("events").select("presale_price").eq("id", event.id).maybeSingle();
      return data?.presale_price != null ? Number(data.presale_price) : null;
    },
  });

  const analise = useMemo(() => {
    const partes = splitTickets(tickets);
    const paraVenda = (t: Ticket): VendaDesconto => {
      const q = t.quantity || 0;
      const unit = precos.data?.get(String(t.sympla_order_id));
      return {
        produto: t.ticket_type,
        quantidade: q,
        pago: t.source === "pipedrive" ? Number(t.total_price || 0) : unit != null ? unit * q : null,
        fonte: t.source === "pipedrive" ? "pipedrive" : "sympla",
        canal: canalDe(t),
        vendidoEm: t.sold_at,
        valorLiquido: t.source === "pipedrive" || t.total_price == null ? null : Number(t.total_price),
      };
    };
    const doEvento = lotes.filter((l) => l.event_id === event.id) as any[];
    const r = resumoDesconto(partes.paying.map(paraVenda), doEvento, preVenda.data);
    // A taxa considera também a visita avulsa paga; ela só não entra no desconto.
    const comTaxa = [...partes.paidSympla, ...partes.visits.filter((t) => t.source !== "pipedrive")].map(paraVenda);
    return {
      r,
      taxa: taxaDaSympla(comTaxa),
      fora: foraDoDesconto(tickets),
      alertas: alertasCrmDesconto(tickets),
      lotesEvento: doEvento,
    };
  }, [tickets, precos.data, lotes, event.id, preVenda.data]);

  const lotesOrdenados = useMemo(() => {
    const vigente = loteVigente(analise.lotesEvento).lote;
    return lotesParaLista(analise.r.porLote.map((l) => l.lote), vigente, analise.lotesEvento)
      .map((nome) => analise.r.porLote.find((l) => l.lote === nome))
      .filter((l): l is NonNullable<typeof l> => !!l);
  }, [analise]);
  const vigente = loteVigente(analise.lotesEvento).lote;
  const grafico = analise.r.porMes.map((m) => ({
    mes: m.mes,
    rotulo: rotuloMes(m.mes),
    noMes: (descontoPonderado(m.soma) ?? 0) * 100,
    acumulado: (descontoPonderado(m.acumulada) ?? 0) * 100,
    soma: m.soma,
    acumuladaSoma: m.acumulada,
  }));

  if (!precos.data || preVenda.isLoading || carregandoLotes) return null;

  const infoResumo = `Mostra quanto os ingressos foram vendidos abaixo do preço de tabela.\n\nO preço de tabela é o valor oficial de cada tipo de ingresso em cada lote, cadastrado em Configurações, Lotes.\n\nO percentual é ponderado pelo valor. Ele pega todo o desconto dado e divide pelo que tudo valeria pela tabela. A média simples entre vendas é ${pctTxt(descontoSimples(analise.r.total))}, e costuma ser diferente porque ingressos mais caros pesam mais.\n\nSympla são as vendas pelo site. Faturado são os negócios fechados pelo comercial.\n\nA taxa da Sympla não entra como desconto. Ela é custo de plataforma e aparece separada no rodapé. Negócios faturados não têm essa taxa.`;
  const infoLote = "Mostra em qual lote demos mais desconto.\n\nCada lote é comparado com o próprio preço de tabela, cadastrado em Configurações, Lotes. Por isso a mudança de preço entre lotes não aparece como desconto.\n\nO lote vigente aparece primeiro. Lotes que ainda não começaram não aparecem na lista.";
  const infoCanal = "Mostra de onde vêm as vendas com mais desconto.\n\nUsa a mesma classificação de canal do quadro Vendas por canal, incluindo os negócios faturados em BDR ou Equipe CUPOLA. O preço de tabela vem de Configurações, Lotes.\n\nO desconto maior em um canal não é necessariamente um problema. Vendas em grupo e negócios fechados pelo comercial têm desconto por natureza.";
  const infoTempo = "Mostra se estamos dando mais ou menos desconto do que a nossa própria média.\n\nA linha do mês é o desconto daquele mês isolado. A linha acumulada é a média de tudo desde o início do período filtrado. Quando a linha do mês fica acima da acumulada, estamos dando mais desconto do que o normal.\n\nO preço de tabela vem de Configurações, Lotes.";
  const infoFora = "Mostra o que não entra na conta do desconto, e por quê. Os preços de tabela usados no quadro vêm de Configurações, Lotes.\n\nCortesias e ingressos de sorteio não entram, porque não são venda com desconto. São ingressos dados.\n\nCupons de 100 por cento usados para emitir ingressos de negócios já faturados também não entram. Esses ingressos já foram pagos no faturado, e contá-los como desconto de 100 por cento inflaria o número.\n\nO resgate é identificado pelo cupom de faturado ou pela correspondência com um negócio. Sem essa identificação, não é possível afirmar a origem e o ingresso fica entre as cortesias.\n\nVisitas avulsas não entram, porque não dão acesso ao evento e têm preço próprio.";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle>{TITULO}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Quanto vendemos abaixo do preço de tabela</p>
      </CardHeader>
      <CardContent>
        {analise.alertas.length > 0 && (
          <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <b className="mb-1 block font-semibold">Há negócios faturados com informações para corrigir no Pipedrive.</b>
              {analise.alertas.map((a) => <span key={a.campo} className="block">{a.campo}: {plural(a.negocios, "negócio", "negócios")}</span>) }
            </div>
          </div>
        )}
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl p-1" aria-label="Visões do desconto médio">
            {[['resumo', 'Resumo'], ['lote', 'Por lote'], ['canal', 'Por canal'], ['tempo', 'No tempo'], ['fora', 'Fora do cálculo']].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="shrink-0 px-3 py-2 text-xs">{label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="resumo" className="mt-0 space-y-5">
            <TituloAba titulo="Resumo" texto={infoResumo} />
            <Conta soma={analise.r.total} className="w-fit">
              <div className="text-4xl font-semibold tabular-nums">{pctTxt(descontoPonderado(analise.r.total))}</div>
            </Conta>
            <Conta soma={analise.r.total} className="w-fit space-y-2 text-sm">
              <p>Deixamos de faturar <b className="font-semibold">{brl(analise.r.total.cheio - analise.r.total.pago)}</b></p>
              <p>Pela tabela, as vendas valeriam <b className="font-semibold">{brl(analise.r.total.cheio)}</b></p>
            </Conta>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fonte nome="Sympla" soma={analise.r.sympla} />
              <Fonte nome="Faturado" soma={analise.r.faturado} />
            </div>
            <div className="border-t border-border pt-4">
              <RodapeTaxa {...analise.taxa} />
            </div>
          </TabsContent>

          <TabsContent value="lote" className="mt-0">
            <TituloAba titulo="Por lote" texto={infoLote} />
            <div className="mb-1 hidden grid-cols-[minmax(150px,1fr)_100px_110px_130px] gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Lote</span><span className="text-right">Desconto</span><span className="text-right">Ingressos</span><span className="text-right">Valor</span>
            </div>
            <div className="rounded-xl border border-border">
              {lotesOrdenados.map(({ lote, soma }) => <LinhaDesconto key={lote} nome={lote} soma={soma} vigente={lote === vigente} />)}
            </div>
            {!lotesOrdenados.length && <p className="text-sm text-muted-foreground">Nenhuma venda com preço de tabela neste período.</p>}
          </TabsContent>

          <TabsContent value="canal" className="mt-0">
            <TituloAba titulo="Por canal" texto={infoCanal} />
            <div className="mb-1 hidden grid-cols-[minmax(150px,1fr)_100px_110px_130px] gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Canal</span><span className="text-right">Desconto</span><span className="text-right">Ingressos</span><span className="text-right">Valor</span>
            </div>
            <div className="rounded-xl border border-border">
              {analise.r.porCanal.map(({ canal, soma }) => <LinhaDesconto key={canal} nome={canal} soma={soma} />)}
            </div>
            {!analise.r.porCanal.length && <p className="text-sm text-muted-foreground">Nenhuma venda com canal identificado neste cálculo.</p>}
          </TabsContent>

          <TabsContent value="tempo" className="mt-0">
            <TituloAba titulo="No tempo" texto={infoTempo} />
            <div className="mb-3 flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-data-blue" /> No mês</span>
              <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-chart-3" /> Acumulado</span>
            </div>
            {grafico.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={grafico} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} className="stroke-border" />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v)}%`} className="fill-muted-foreground" />
                  <ChartTooltip content={<TooltipTempo />} />
                  <Line type="monotone" dataKey="noMes" name="No mês" stroke="hsl(var(--data-blue))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">Ainda não há meses com vendas neste cálculo.</p>}
          </TabsContent>

          <TabsContent value="fora" className="mt-0">
            <TituloAba titulo="Fora do cálculo" texto={infoFora} />
            <div className="space-y-2">
              {analise.fora.map((item) => (
                <div key={item.id} className="grid gap-1 rounded-xl border border-border px-3 py-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_100px] sm:items-start">
                  <b className="font-medium">{item.rotulo}</b>
                  <span className="text-xs text-muted-foreground">{item.motivo}</span>
                  <span className="text-right font-semibold tabular-nums">{plural(item.quantidade, "ingresso", "ingressos")}</span>
                </div>
              ))}
              {analise.r.semReferencia.map((item) => (
                <div key={`${item.nome}|${item.motivo}`} className="grid gap-1 rounded-xl border border-warning/40 bg-warning/5 px-3 py-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_100px] sm:items-start">
                  <b className="break-words font-medium">{item.nome}</b>
                  <span className="text-xs text-muted-foreground">{item.motivo}</span>
                  <span className="text-right font-semibold tabular-nums">{plural(item.quantidade, "ingresso", "ingressos")}</span>
                </div>
              ))}
            </div>
            {!analise.fora.length && !analise.r.semReferencia.length && <p className="text-sm text-muted-foreground">Nada ficou fora do cálculo neste período.</p>}
            <p className="mt-4 text-xs text-muted-foreground">Resgates dependem da identificação do cupom de faturado ou da correspondência com um negócio. Sem isso, a origem não pode ser afirmada.</p>
          </TabsContent>
        </Tabs>
        <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">Preços de tabela vindos de Configurações, Lotes.</p>
      </CardContent>
    </Card>
  );
}
