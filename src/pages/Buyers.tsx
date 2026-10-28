import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent, type EventRow } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { ProfileCharts } from "@/components/buyers/ProfileCharts";
import { PeopleTable } from "@/components/buyers/PeopleTable";
import { SellerBuyerList } from "@/components/buyers/SellerBuyerList";
import { useAllTimeTicketSales, useFormAnswerCounts } from "@/hooks/useDashboardData";
import { buildBuyers, eventRef, type DetailRow } from "@/lib/buyers";

const int = (n: number) => n.toLocaleString("pt-BR");

// Lê uma consulta em páginas de 1000 linhas.
async function paginado(consulta: (from: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  const todos: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await consulta(from);
    if (error || !data) break;
    todos.push(...data);
    if (data.length < 1000) break;
  }
  return todos;
}

// Cupom de cada ingresso do evento: das vendas atuais e das guardadas na base própria.
async function loadCoupons(e: EventRow): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const historico = await paginado((from) =>
    supabase
      .from("event_history" as any)
      .select("sid:data->>sympla_order_id, cupom:data->>coupon_code")
      .eq("event_key", e.slug)
      .eq("source_table", "ticket_sales")
      .not("data->>coupon_code", "is", null)
      .range(from, from + 999),
  );
  historico.forEach((r) => r.sid && r.cupom && map.set(String(r.sid), r.cupom));
  if (e.sympla_event_id) {
    const vendas = await paginado((from) =>
      supabase
        .from("ticket_sales")
        .select("sympla_order_id, coupon_code")
        .eq("event_id", e.sympla_event_id!)
        .not("coupon_code", "is", null)
        .range(from, from + 999),
    );
    vendas.forEach((r) => map.set(String(r.sympla_order_id), r.coupon_code));
  }
  return map;
}

// Dados completos de um evento: os da Sympla e os guardados na base própria, sem repetir pedidos, com o cupom.
async function loadEventRows(e: EventRow): Promise<DetailRow[]> {
  const map = new Map<string, DetailRow>();
  const historico = await paginado((from) =>
    supabase
      .from("event_history" as any)
      .select("data")
      .eq("event_key", e.slug)
      .eq("source_table", "ticket_sales_details")
      .range(from, from + 999),
  );
  historico.forEach((r) => map.set(r.data.sympla_order_id, r.data));
  if (e.sympla_event_id) {
    const id = e.sympla_event_id;
    const atuais = await paginado((from) =>
      supabase
        .from("ticket_sales_details" as any)
        .select("sympla_order_id, participant_data, order_data")
        .or(`participant_data->>event_id.eq.${id},order_data->>event_id.eq.${id}`)
        .range(from, from + 999),
    );
    atuais.forEach((r) => map.set(r.sympla_order_id, r));
  }
  const cupons = await loadCoupons(e);
  return Array.from(map.values()).map((r) => ({ ...r, coupon: cupons.get(String(r.sympla_order_id)) ?? null }));
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <Card className="col-span-6 flex flex-col gap-2 p-5 lg:col-span-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        {title} <InfoTip title={title} />
      </div>
      <div className="text-[clamp(26px,2.6vw,34px)] font-semibold leading-none tracking-[-0.035em]">{int(value)}</div>
    </Card>
  );
}

// A equipe de vendas vê só a lista para buscar e abordar; os demais veem a página completa.
export default function Buyers() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerBuyerList /> : <FullBuyers />;
}

// Perfil de quem vem ao evento (todos) e a lista de pessoas com filtros (só administradores).
function FullBuyers() {
  const { isAdmin } = useAuth();
  const { events, event } = useEvent();
  const [aba, setAba] = useState("perfil");
  const perfilTickets = useAllTimeTicketSales(event.sympla_event_id ?? "");
  const perfilRespostas = useFormAnswerCounts(event.sympla_event_id ?? "");

  // Referência é o evento selecionado: entram ele e os eventos anteriores (para saber quem já veio antes).
  const relevantes = useMemo(() => events.filter((e) => e.slug === event.slug || e.end_date < event.end_date), [events, event]);

  const dados = useQuery({
    queryKey: ["buyers", event.slug, relevantes.map((e) => `${e.slug}:${e.sympla_event_id}`).join("|")],
    enabled: isAdmin && relevantes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => Promise.all(relevantes.map(async (e) => ({ event: eventRef(e), rows: await loadEventRows(e) }))),
  });

  const { people, companies } = useMemo(() => buildBuyers(dados.data ?? []), [dados.data]);
  const eventos = useMemo(() => (dados.data ?? []).map((d) => d.event).sort((a, b) => a.endDate.localeCompare(b.endDate)), [dados.data]);

  // Números do evento selecionado; "já vieram" é quem também aparece em algum evento anterior.
  const kpis = useMemo(() => {
    const noEvento = people.filter((p) => p.events[event.slug]);
    const empresas = companies.filter((c) => c.events[event.slug]);
    return {
      pessoas: noEvento.length,
      voltaram: noEvento.filter((p) => Object.keys(p.events).length > 1).length,
      empresas: empresas.length,
      empresasVoltaram: empresas.filter((c) => Object.keys(c.events).length > 1).length,
    };
  }, [people, companies, event.slug]);

  return (
    <div className="space-y-6">
      <PageHeader title="Compradores" description="Quem vem ao evento selecionado, o perfil dessas pessoas e quem já veio em anos anteriores." />

      {isAdmin && (
        <div className="grid grid-cols-12 gap-[14px]">
          {dados.isLoading ? (
            <Skeleton className="col-span-12 h-28" />
          ) : (
            <>
              <Kpi title="Pessoas no evento" value={kpis.pessoas} />
              <Kpi title="Já vieram antes" value={kpis.voltaram} />
              <Kpi title="Empresas no evento" value={kpis.empresas} />
              <Kpi title="Empresas que já vieram" value={kpis.empresasVoltaram} />
            </>
          )}
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        {isAdmin && (
          <SlidingTabsList value={aba} className="mb-4">
            {[
              ["perfil", "Perfil"],
              ["pessoas", "Pessoas"],
            ].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="relative z-[1] data-[state=active]:bg-transparent data-[state=active]:text-background">
                {l}
              </TabsTrigger>
            ))}
          </SlidingTabsList>
        )}

        <TabsContent value="perfil" className="mt-0">
          <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
            {perfilTickets.isLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <ProfileCharts tickets={perfilTickets.data ?? []} formAnswers={perfilRespostas.data ?? []} />
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pessoas" className="mt-0">
            {dados.isLoading ? (
              <Skeleton className="h-96" />
            ) : (
              <PeopleTable people={people} eventos={eventos} eventSlug={event.slug} />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
