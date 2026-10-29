import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseCoupon } from "@/lib/coupons";
import { formatPhone, type EventRef, type Person } from "@/lib/buyers";
import { cn } from "@/lib/utils";

const int = (n: number) => n.toLocaleString("pt-BR");
const PAGE = 100;

export type Escopo = "neste" | "fora" | "todos";
type Marca = "recorrente" | "cupom" | "pendente";

const APROVADO = new Set(["APPROVED", "A"]);
const SITUACAO: Record<string, { label: string; variant: "warn" | "bad" | "neutral" }> = {
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

interface PeopleTableProps {
  people: Person[];
  // Todos os eventos CUPOLA carregados (edições, imersões…), do mais antigo ao mais recente.
  eventos: EventRef[];
  eventSlug: string;
  // Equipe de vendas: sem e-mail, telefone e pedidos; contato só serve para localizar na busca.
  restrito?: boolean;
  escopoInicial?: Escopo;
  // Só quem participou do evento selecionado: sem abas de escopo nem filtros de outros eventos (equipe de vendas).
  soEsteEvento?: boolean;
}

// Lista de pessoas com filtros: quem veio neste evento, quem ainda não veio, clientes recorrentes de qualquer evento
// CUPOLA, quem participou de um evento específico e quem usou cupom.
export function PeopleTable({ people, eventos, eventSlug, restrito = false, escopoInicial = "neste", soEsteEvento = false }: PeopleTableProps) {
  const [participouDe, setParticipouDe] = useState("qualquer");
  const [busca, setBusca] = useState("");
  const [escopo, setEscopo] = useState<Escopo>(soEsteEvento ? "neste" : escopoInicial);
  const [marcas, setMarcas] = useState<Set<Marca>>(new Set());
  const [limite, setLimite] = useState(PAGE);

  // Dados prontos para filtrar e mostrar.
  const linhas = useMemo(
    () =>
      people.map((p) => {
        const neste = p.events[eventSlug];
        // Eventos da pessoa em ordem de data; recorrente é quem participou de dois ou mais eventos CUPOLA, de qualquer tipo.
        const eventosDaPessoa = Object.values(p.events)
          .map((e) => e.event)
          .sort((a, b) => a.endDate.localeCompare(b.endDate));
        // Cupons do evento atual primeiro; os dos outros eventos vêm depois, do mais recente ao mais antigo.
        const cupons = [...eventosDaPessoa]
          .sort((a, b) => Number(b.slug === eventSlug) - Number(a.slug === eventSlug) || b.endDate.localeCompare(a.endDate))
          .flatMap((ev) =>
            Array.from(p.events[ev.slug].coupons).map((c) => ({ code: parseCoupon(c)?.code ?? c, evento: ev.label, atual: ev.slug === eventSlug })),
          )
          .filter((c, i, arr) => arr.findIndex((x) => x.code === c.code && x.evento === c.evento) === i);
        const pendencias = Array.from(neste?.statuses ?? []).filter((s) => !APROVADO.has(s));
        return { p, neste: !!neste, recorrente: eventosDaPessoa.length >= 2, eventosDaPessoa, cupons, pendencias };
      }),
    [people, eventSlug],
  );

  // Busca por contato: a equipe digita e-mail ou telefone e o banco devolve a chave do que foi digitado.
  const termo = busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const pareceContato = termo.includes("@") || digitos.length >= 10;
  const [termoContato, setTermoContato] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setTermoContato(restrito && pareceContato ? termo : ""), 400);
    return () => clearTimeout(id);
  }, [termo, pareceContato, restrito]);
  const chaves = useQuery({
    queryKey: ["contact-keys", termoContato],
    enabled: !!termoContato,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.rpc("contact_search_keys" as any, { p_term: termoContato });
      const r = ((data ?? []) as { email_key: string | null; phone_key: string | null }[])[0];
      return [r?.email_key, r?.phone_key].filter(Boolean) as string[];
    },
  });
  const chavesBusca = restrito && pareceContato && termoContato === termo ? chaves.data ?? [] : [];
  const contatoConfere = (p: Person) => chavesBusca.some((k) => p.emails.includes(k) || p.phones.includes(k));

  const casaBusca = (p: Person) => {
    if (!termo) return true;
    if (restrito && pareceContato) return contatoConfere(p);
    return (
      p.name.toLowerCase().includes(termo) ||
      p.companies.some((c) => c.toLowerCase().includes(termo)) ||
      (!restrito && (p.emails.some((e) => e.includes(termo)) || (digitos.length >= 4 && p.phones.some((t) => t.includes(digitos)))))
    );
  };

  const casaMarcas = (l: (typeof linhas)[number]) =>
    (participouDe === "qualquer" || !!l.p.events[participouDe]) &&
    (!marcas.has("recorrente") || l.recorrente) &&
    (!marcas.has("cupom") || l.cupons.length > 0) &&
    (!marcas.has("pendente") || l.pendencias.length > 0);
  const casaEscopo = (l: (typeof linhas)[number], e: Escopo) => e === "todos" || (e === "neste") === l.neste;

  // Buscando, procura em todos; sem busca, vale o escopo escolhido.
  const lista = useMemo(
    () =>
      linhas
        .filter((l) => (termo ? true : casaEscopo(l, escopo)) && casaMarcas(l) && casaBusca(l.p))
        .sort((a, b) => b.eventosDaPessoa.length - a.eventosDaPessoa.length || a.p.name.localeCompare(b.p.name, "pt-BR")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, escopo, marcas, participouDe, termo, chavesBusca.join("|")],
  );

  const contaEscopo = (e: Escopo) => linhas.filter((l) => casaEscopo(l, e) && casaMarcas(l)).length;
  const contaMarca = (m: Marca) =>
    linhas.filter(
      (l) =>
        casaEscopo(l, escopo) &&
        (participouDe === "qualquer" || !!l.p.events[participouDe]) &&
        (m === "recorrente" ? l.recorrente : m === "cupom" ? l.cupons.length > 0 : l.pendencias.length > 0),
    ).length;

  const trocarMarca = (m: Marca) => {
    setMarcas((atual) => {
      const nova = new Set(atual);
      if (nova.has(m)) nova.delete(m);
      else nova.add(m);
      return nova;
    });
    setLimite(PAGE);
  };

  const escopos: [Escopo, string][] = [
    ["neste", "Vieram a este evento"],
    ["fora", "Ainda não vieram a este"],
    ["todos", "Todos"],
  ];
  const ordemEscopos = escopoInicial === "fora" ? [escopos[1], escopos[0], escopos[2]] : escopos;
  const marcasDisponiveis: [Marca, string][] = [
    ...(soEsteEvento ? [] : ([["recorrente", "Clientes recorrentes"]] as [Marca, string][])),
    ["cupom", "Usaram cupom"],
    ...(restrito ? [] : ([["pendente", "Pedido pendente"]] as [Marca, string][])),
  ];
  const mostrarPedido = marcas.has("pendente");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setLimite(PAGE); }}
            placeholder="Buscar por nome, empresa, e-mail ou telefone"
            className="h-10 w-full max-w-sm rounded-full bg-card"
          />
          {!soEsteEvento && <div className={cn("inline-flex flex-wrap items-center gap-0.5 rounded-[18px] border bg-secondary p-1", termo && "opacity-50")}>
            {ordemEscopos.map(([e, rotulo]) => (
              <button
                key={e}
                type="button"
                onClick={() => { setEscopo(e); setLimite(PAGE); }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                  escopo === e ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {rotulo} <span className="tabular-nums opacity-70">{int(contaEscopo(e))}</span>
              </button>
            ))}
          </div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar:</span>
          {marcasDisponiveis.map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              aria-pressed={marcas.has(m)}
              onClick={() => trocarMarca(m)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150",
                marcas.has(m) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:border-line-strong hover:text-foreground",
              )}
            >
              {rotulo} <span className="tabular-nums opacity-70">{int(contaMarca(m))}</span>
            </button>
          ))}
          {!soEsteEvento && eventos.length > 1 && (
            <Select value={participouDe} onValueChange={(v) => { setParticipouDe(v); setLimite(PAGE); }}>
              <SelectTrigger
                className={cn(
                  "h-7 w-auto gap-1.5 rounded-full px-3 text-xs font-semibold",
                  participouDe !== "qualquer" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qualquer">Participou de qualquer evento</SelectItem>
                {[...eventos].reverse().map((ev) => (
                  <SelectItem key={ev.slug} value={ev.slug}>
                    Participou de {ev.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {termo && <span className="text-xs text-muted-foreground">Buscando em todas as pessoas.</span>}
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {lista.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {restrito && pareceContato
                ? chaves.isFetching || termoContato !== termo
                  ? "Procurando…"
                  : "Ninguém com esse e-mail ou telefone nos eventos."
                : "Ninguém encontrado com esses filtros."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  {!restrito && <TableHead>E-mail</TableHead>}
                  {!restrito && <TableHead>Telefone</TableHead>}
                  <TableHead>Participou</TableHead>
                  <TableHead>Cupom</TableHead>
                  {mostrarPedido && <TableHead>Pedido</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.slice(0, limite).map(({ p, eventosDaPessoa, cupons, pendencias }) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {restrito && pareceContato && contatoConfere(p) && (
                        <Chip variant="blue" className="ml-2">Contato confere</Chip>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[170px] truncate text-foreground/80" title={p.companies.join(", ")}>
                      {p.companies[0] ?? "—"}
                    </TableCell>
                    {!restrito && (
                      <TableCell className="max-w-[210px] truncate text-foreground/80" title={p.emails.join(", ")}>
                        {p.emails[0] ?? "—"}
                      </TableCell>
                    )}
                    {!restrito && (
                      <TableCell className="whitespace-nowrap tabular-nums text-foreground/80">{p.phones[0] ? formatPhone(p.phones[0]) : "—"}</TableCell>
                    )}
                    <TableCell>
                      <span className="flex max-w-[280px] flex-wrap gap-1">
                        {eventosDaPessoa.map((ev) => (
                          <span
                            key={ev.slug}
                            title={ev.name}
                            className={cn(
                              "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              ev.slug === eventSlug ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80",
                            )}
                          >
                            {ev.label}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {/* Um cupom só: o deste evento (ou o mais recente); os demais aparecem ao passar o mouse. */}
                      {cupons.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          title={cupons.map((c) => `${c.code} (${c.evento})`).join("\n")}
                          className={cn(
                            "inline-block max-w-[180px] truncate rounded-md px-1.5 py-0.5 align-middle font-mono text-[11px]",
                            cupons[0].atual ? "bg-data-blue/10 text-data-blue" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {cupons[0].code}
                          {!cupons[0].atual && <span className="ml-1 font-sans opacity-70">{cupons[0].evento}</span>}
                        </span>
                      )}
                    </TableCell>
                    {mostrarPedido && (
                      <TableCell className="whitespace-nowrap">
                        {pendencias.map((s) => (
                          <Chip key={s} variant={SITUACAO[s]?.variant ?? "neutral"} className="mr-1">{SITUACAO[s]?.label ?? s}</Chip>
                        ))}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {lista.length > limite && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimite((l) => l + PAGE)}>
            Mostrar mais ({int(lista.length - limite)} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
