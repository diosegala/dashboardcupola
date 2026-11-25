import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTip } from "@/components/InfoTip";
import { useEvent } from "@/hooks/useEvent";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { montarQuadroVisitas, origemDaVisita, NAO_INFORMADO, type CampoFormulario, type GrupoFinalidade } from "@/lib/visitBoard";
import { ABRIR_EXTRATO_VISITAS } from "@/components/buyers/SalesStatement";
import { cn } from "@/lib/utils";

const TITULO = "Visitas presenciais";
const int = (n: number) => n.toLocaleString("pt-BR");
const COR_AVULSA = "hsl(var(--chart-2))";
const COR_COMBO = "hsl(var(--chart-1))";

// Texto do mouse em cada finalidade: divisão avulsa/combo, escritas agrupadas e, em Não informado, o motivo.
function dica(g: GrupoFinalidade): string {
  const partes = [`Avulsa: ${int(g.avulsa)} · Combo: ${int(g.combo)}`];
  if (g.motivos) Object.entries(g.motivos).forEach(([m, n]) => partes.push(`${m}: ${int(n)}`));
  if (g.escritas.length > 1) partes.push(`Escritas agrupadas: ${g.escritas.map((e) => `"${e}"`).join(", ")}`);
  return partes.join("\n");
}

// Quantas visitas, de onde vieram (avulsa ou combo), a finalidade escolhida e quem comprou visita avulsa.
export function VisitsCard({ tickets, className }: { tickets: Ticket[]; className?: string }) {
  const { event } = useEvent();
  const pedidosDeVisita = useMemo(() => {
    const { paying, visits } = splitTickets(tickets);
    return [...visits, ...paying]
      .filter((t) => t.source !== "pipedrive" && t.sympla_order_id && origemDaVisita(t.ticket_type))
      .map((t) => String(t.sympla_order_id))
      .sort();
  }, [tickets]);
  // Formulário só dos pedidos com visita (nome da pergunta e resposta), em blocos para não estourar a URL.
  const formularios = useQuery({
    queryKey: ["formularios-visitas", event.slug, pedidosDeVisita.join(",")],
    enabled: pedidosDeVisita.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const mapa = new Map<string, CampoFormulario[]>();
      for (let i = 0; i < pedidosDeVisita.length; i += 100) {
        const { data, error } = await supabase
          .from("ticket_sales_details")
          .select("sympla_order_id, form:participant_data->custom_form")
          .in("sympla_order_id", pedidosDeVisita.slice(i, i + 100));
        if (error) throw error;
        ((data ?? []) as any[]).forEach((r) => mapa.set(String(r.sympla_order_id), Array.isArray(r.form) ? r.form : []));
      }
      return mapa;
    },
  });

  const quadro = useMemo(() => {
    const { paying, visits } = splitTickets(tickets);
    return montarQuadroVisitas([...visits, ...paying] as any[], formularios.data ?? new Map());
  }, [tickets, formularios.data]);

  if (quadro.total === 0) return null;
  const maior = Math.max(...quadro.finalidades.map((f) => f.total), 1);
  const pct = (n: number) => `${(n / quadro.total) * 100}%`;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {TITULO} <InfoTip title={TITULO} />
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Visitas vendidas no período, de onde vieram e a finalidade escolhida no formulário</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[clamp(30px,3vw,40px)] font-semibold leading-none tracking-[-0.035em] tabular-nums">{int(quadro.total)}</span>
              <span className="text-sm text-muted-foreground">{quadro.total === 1 ? "visita" : "visitas"}</span>
            </div>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-secondary">
              <i className="block h-full" style={{ width: pct(quadro.avulsas), background: COR_AVULSA }} />
              <i className="block h-full" style={{ width: pct(quadro.combos), background: COR_COMBO }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_AVULSA }} /><b className="tabular-nums">{int(quadro.avulsas)}</b> avulsas <span className="text-muted-foreground">(sem acesso ao evento)</span></span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_COMBO }} /><b className="tabular-nums">{int(quadro.combos)}</b> de combo <span className="text-muted-foreground">(incluídas no ingresso)</span></span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground/75">Finalidade escolhida</p>
            {quadro.perguntaNaoEncontrada ? (
              <div className="flex gap-2 rounded-md bg-warn-bg p-3 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="font-semibold">A pergunta de finalidade da visita não foi encontrada no formulário da Sympla.</p>
                  <p className="mt-1">Perguntas que existem hoje: {quadro.perguntaNaoEncontrada.map((q) => `"${q}"`).join(", ")}. Avise no chat qual delas é a da visita para corrigir o reconhecimento.</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {quadro.finalidades.map((g) => (
                  <li key={g.rotulo}>
                    <Tooltip delayDuration={80}>
                      <TooltipTrigger asChild>
                        <div tabIndex={0} className="grid cursor-help grid-cols-[110px_minmax(0,1fr)_36px] items-center gap-3 rounded-sm text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className={cn("truncate", g.rotulo === NAO_INFORMADO && "text-muted-foreground")}>{g.rotulo}</span>
                          <span className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
                            <i className="block h-full" style={{ width: `${(g.avulsa / maior) * 100}%`, background: COR_AVULSA }} />
                            <i className="block h-full" style={{ width: `${(g.combo / maior) * 100}%`, background: COR_COMBO }} />
                          </span>
                          <b className="text-right tabular-nums">{int(g.total)}</b>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[320px] whitespace-pre-line text-xs">{dica(g)}</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
            {quadro.parecidas.length > 0 && (
              <div className="mt-3 flex gap-2 rounded-md bg-warn-bg p-3 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>Respostas parecidas, mas não iguais, ficaram separadas: {quadro.parecidas.map(([a, b]) => `"${a}" e "${b}"`).join("; ")}. Diga no chat se são a mesma opção.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:border-l lg:pl-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground/75">Quem comprou visita avulsa</p>
            {quadro.avulsas > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-xs" onClick={() => window.dispatchEvent(new Event(ABRIR_EXTRATO_VISITAS))}>
                Ver no extrato <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
          {quadro.compradores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma visita avulsa no período.</p>
          ) : (
            <ul className="divide-y">
              {quadro.compradores.map((c) => (
                <li key={`${c.email ?? c.nome}`} className="py-2.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{c.nome}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{int(c.quantidade)} {c.quantidade === 1 ? "visita" : "visitas"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[c.empresa, c.data ? format(new Date(c.data), "dd/MM/yyyy") : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs">{c.finalidades.map((f) => `${f.rotulo} ${int(f.total)}`).join(", ")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
