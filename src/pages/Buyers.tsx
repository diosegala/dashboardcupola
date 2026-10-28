import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent, type EventRow } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { buildBuyers, formatPhone, maskCpf, pendingOrders, type DetailRow, type EventRef } from "@/lib/buyers";

const int = (n: number) => n.toLocaleString("pt-BR");
const PAGE = 100;

const STATUS: Record<string, { label: string; variant: "warn" | "bad" | "neutral" }> = {
  PENDING: { label: "Pendente", variant: "warn" },
  P: { label: "Pendente", variant: "warn" },
  CANCELLED: { label: "Cancelado", variant: "bad" },
  CANCELED: { label: "Cancelado", variant: "bad" },
  C: { label: "Cancelado", variant: "bad" },
  REFUSED: { label: "Recusado", variant: "bad" },
  REJECTED: { label: "Recusado", variant: "bad" },
  REFUNDED: { label: "Reembolsado", variant: "neutral" },
  R: { label: "Reembolsado", variant: "neutral" },
};

function eventRef(e: EventRow): EventRef {
  const year = e.name.match(/\b(20\d{2})\b/)?.[1] ?? e.end_date.slice(0, 4);
  return { slug: e.slug, name: e.name, year };
}

// Dados completos de um evento: os da Sympla e os guardados na base própria, sem repetir pedidos.
async function loadEventRows(e: EventRow): Promise<DetailRow[]> {
  const map = new Map<string, DetailRow>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("event_history" as any)
      .select("data")
      .eq("event_key", e.slug)
      .eq("source_table", "ticket_sales_details")
      .range(from, from + 999);
    if (error) break;
    (data ?? []).forEach((r: any) => map.set(r.data.sympla_order_id, r.data));
    if (!data || data.length < 1000) break;
  }
  if (e.sympla_event_id) {
    const id = e.sympla_event_id;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("ticket_sales_details" as any)
        .select("sympla_order_id, participant_data, order_data")
        .or(`participant_data->>event_id.eq.${id},order_data->>event_id.eq.${id}`)
        .range(from, from + 999);
      if (error) break;
      (data ?? []).forEach((r: any) => map.set(r.sympla_order_id, r));
      if (!data || data.length < 1000) break;
    }
  }
  return Array.from(map.values());
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

// Compradores e participantes de todos os eventos, com recorrência e pedidos a acompanhar. Só administradores.
export default function Buyers() {
  const { isAdmin, loading } = useAuth();
  const { events, event } = useEvent();
  const [aba, setAba] = useState("pessoas");
  const [busca, setBusca] = useState("");
  const [soRecorrentes, setSoRecorrentes] = useState(false);
  const [limite, setLimite] = useState(PAGE);

  // Referência é o evento selecionado: entram ele e os eventos anteriores (para saber quem já veio antes).
  const relevantes = useMemo(() => events.filter((e) => e.slug === event.slug || e.end_date < event.end_date), [events, event]);
  const anteriores = useMemo(() => new Set(relevantes.filter((e) => e.slug !== event.slug).map((e) => e.slug)), [relevantes, event.slug]);

  const dados = useQuery({
    queryKey: ["buyers", event.slug, relevantes.map((e) => `${e.slug}:${e.sympla_event_id}`).join("|")],
    enabled: isAdmin && relevantes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => Promise.all(relevantes.map(async (e) => ({ event: eventRef(e), rows: await loadEventRows(e) }))),
  });

  // Só quem está no evento selecionado; recorrente é quem também aparece em algum evento anterior.
  const { people, companies } = useMemo(() => {
    const all = buildBuyers(dados.data ?? []);
    const veioAntes = (evs: Record<string, unknown>) => Object.keys(evs).some((slug) => anteriores.has(slug));
    return {
      people: all.people.filter((p) => p.events[event.slug]).map((p) => ({ ...p, recurring: veioAntes(p.events) })),
      companies: all.companies.filter((c) => c.events[event.slug]).map((c) => ({ ...c, recurring: veioAntes(c.events) })),
    };
  }, [dados.data, anteriores, event.slug]);
  const pedidos = useMemo(
    () => pendingOrders(dados.data?.find((d) => d.event.slug === event.slug)?.rows ?? []),
    [dados.data, event.slug],
  );
  const anos = useMemo(() => Array.from(new Set((dados.data ?? []).map((d) => d.event.year))).sort(), [dados.data]);

  const termo = busca.trim().toLowerCase();
  const pessoas = useMemo(
    () =>
      people
        .filter((p) => !soRecorrentes || p.recurring)
        .filter(
          (p) =>
            !termo ||
            p.name.toLowerCase().includes(termo) ||
            p.emails.some((e) => e.includes(termo)) ||
            p.companies.some((c) => c.toLowerCase().includes(termo)) ||
            p.phones.some((t) => t.includes(termo.replace(/\D/g, "") || "#")),
        )
        .sort((a, b) => Number(b.recurring) - Number(a.recurring) || a.name.localeCompare(b.name, "pt-BR")),
    [people, soRecorrentes, termo],
  );
  const empresas = useMemo(
    () =>
      companies
        .filter((c) => !soRecorrentes || c.recurring)
        .filter((c) => !termo || c.name.toLowerCase().includes(termo) || (c.cnpj ?? "").includes(termo.replace(/\D/g, "") || "#"))
        .sort((a, b) => Number(b.recurring) - Number(a.recurring) || b.people - a.people),
    [companies, soRecorrentes, termo],
  );

  if (!loading && !isAdmin) return <Navigate to="/" replace />;

  const eventChips = (evs: Record<string, { event: EventRef; roles?: Set<string> }>) =>
    anos.map((ano) => {
      const e = Object.values(evs).find((x) => x.event.year === ano);
      if (!e) return null;
      const papel = e.roles ? (e.roles.has("comprador") && e.roles.has("participante") ? "comprou e participou" : e.roles.has("comprador") ? "comprou" : "participou") : "";
      return (
        <Chip key={ano} variant={e.roles?.has("comprador") ? "paid" : "neutral"} className="mr-1" dot={false}>
          {ano}
          {papel && <span className="font-normal opacity-75"> · {papel}</span>}
        </Chip>
      );
    });

  return (
    <div className="space-y-6">
      <PageHeader title="Compradores" description="Quem comprou ou vai participar do evento selecionado e quem já veio em anos anteriores." />

      {dados.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-[14px]">
            <Kpi title="Pessoas no evento" value={people.length} />
            <Kpi title="Já vieram antes" value={people.filter((p) => p.recurring).length} />
            <Kpi title="Empresas no evento" value={companies.length} />
            <Kpi title="Empresas que já vieram" value={companies.filter((c) => c.recurring).length} />
          </div>

          <Tabs value={aba} onValueChange={(v) => { setAba(v); setLimite(PAGE); }}>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SlidingTabsList value={aba}>
                {[
                  ["pessoas", "Pessoas"],
                  ["empresas", "Empresas"],
                  ["pedidos", `Pedidos para acompanhar (${int(pedidos.length)})`],
                ].map(([v, l]) => (
                  <TabsTrigger key={v} value={v} className="relative z-[1] data-[state=active]:bg-transparent data-[state=active]:text-background">
                    {l}
                  </TabsTrigger>
                ))}
              </SlidingTabsList>
              {aba !== "pedidos" && (
                <>
                  <Input
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setLimite(PAGE); }}
                    placeholder={aba === "pessoas" ? "Buscar por nome, e-mail, telefone ou empresa" : "Buscar por empresa ou CNPJ"}
                    className="h-10 max-w-sm rounded-full"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={soRecorrentes} onCheckedChange={(v) => setSoRecorrentes(!!v)} />
                    Só recorrentes
                  </label>
                </>
              )}
            </div>

            <div className="rounded-[28px] border bg-bg-alt/85 p-3 sm:p-5">
              <TabsContent value="pessoas" className="mt-0">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Eventos</TableHead>
                          <TableHead className="text-right">Ingressos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pessoas.slice(0, limite).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                {p.name}
                                {p.recurring && <Chip variant="ok">Recorrente</Chip>}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate" title={p.emails.join(", ")}>
                              {p.emails[0] ?? "—"}
                              {p.emails.length > 1 && <span className="text-muted-foreground"> +{p.emails.length - 1}</span>}
                            </TableCell>
                            <TableCell>{p.phones[0] ? formatPhone(p.phones[0]) : "—"}</TableCell>
                            <TableCell className="tabular-nums">{maskCpf(p.cpf)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{p.companies[0] ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{eventChips(p.events)}</TableCell>
                            <TableCell className="text-right tabular-nums">{int(p.events[event.slug]?.tickets ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {pessoas.length > limite && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => setLimite((l) => l + PAGE)}>
                      Mostrar mais ({int(pessoas.length - limite)} restantes)
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="empresas" className="mt-0">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Eventos</TableHead>
                          <TableHead className="text-right">Pessoas</TableHead>
                          <TableHead className="text-right">Ingressos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {empresas.slice(0, limite).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                {c.name}
                                {c.recurring && <Chip variant="ok">Recorrente</Chip>}
                              </span>
                            </TableCell>
                            <TableCell className="tabular-nums">{c.cnpj ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{eventChips(c.events)}</TableCell>
                            <TableCell className="text-right tabular-nums">{int(c.people)}</TableCell>
                            <TableCell className="text-right tabular-nums">{int(c.events[event.slug]?.tickets ?? 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {empresas.length > limite && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => setLimite((l) => l + PAGE)}>
                      Mostrar mais ({int(empresas.length - limite)} restantes)
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pedidos" className="mt-0">
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    {pedidos.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">Nenhum pedido pendente, recusado ou cancelado em {event.name}.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Comprador</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Ingressos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pedidos.map((o) => (
                            <TableRow key={o.orderId}>
                              <TableCell className="font-medium">{o.orderId}</TableCell>
                              <TableCell>{o.buyer}</TableCell>
                              <TableCell>{o.email ?? "—"}</TableCell>
                              <TableCell>
                                <Chip variant={STATUS[o.status]?.variant ?? "neutral"}>{STATUS[o.status]?.label ?? o.status}</Chip>
                              </TableCell>
                              <TableCell>{o.date ? new Date(o.date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{int(o.tickets)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </div>
  );
}
