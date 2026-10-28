import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEvent } from "@/hooks/useEvent";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { buildBuyers, eventRef, formatPhone, type DetailRow } from "@/lib/buyers";
import { cn } from "@/lib/utils";

const int = (n: number) => n.toLocaleString("pt-BR");
const PAGE = 100;

type Filtro = "nao" | "sim" | "todos";

// Lista enxuta para a equipe de vendas: quem já veio e quem já comprou, para abordar quem ainda não comprou.
// Os dados vêm de uma função do banco que entrega só nome, contato, empresa e situação (sem CPF).
export function SellerBuyerList() {
  const { events, event } = useEvent();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("nao");
  const [limite, setLimite] = useState(PAGE);

  const relevantes = useMemo(() => events.filter((e) => e.slug === event.slug || e.end_date < event.end_date), [events, event]);

  const dados = useQuery({
    queryKey: ["buyers-equipe", event.slug, relevantes.map((e) => e.slug).join("|")],
    enabled: relevantes.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () =>
      Promise.all(
        relevantes.map(async (e) => {
          const { data, error } = await supabase.rpc("get_buyer_rows" as any, { p_slug: e.slug });
          return { event: eventRef(e), rows: error ? [] : ((data ?? []) as DetailRow[]) };
        }),
      ),
  });

  const anos = useMemo(() => Array.from(new Set((dados.data ?? []).map((d) => d.event.year))).sort(), [dados.data]);
  const pessoas = useMemo(
    () => buildBuyers(dados.data ?? []).people.map((p) => ({ ...p, comprou: !!p.events[event.slug] })),
    [dados.data, event.slug],
  );
  const contagem = { nao: pessoas.filter((p) => !p.comprou).length, sim: pessoas.filter((p) => p.comprou).length, todos: pessoas.length };

  const termo = busca.trim().toLowerCase();
  const lista = useMemo(
    () =>
      pessoas
        .filter((p) => filtro === "todos" || (filtro === "sim") === p.comprou)
        .filter(
          (p) =>
            !termo ||
            p.name.toLowerCase().includes(termo) ||
            p.emails.some((e) => e.includes(termo)) ||
            p.companies.some((c) => c.toLowerCase().includes(termo)) ||
            p.phones.some((t) => t.includes(termo.replace(/\D/g, "") || "#")),
        )
        .sort((a, b) => Object.keys(b.events).length - Object.keys(a.events).length || a.name.localeCompare(b.name, "pt-BR")),
    [pessoas, filtro, termo],
  );

  const botao = (f: Filtro, rotulo: string) => (
    <button
      type="button"
      onClick={() => { setFiltro(f); setLimite(PAGE); }}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
        filtro === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {rotulo} <span className="tabular-nums opacity-70">{int(contagem[f])}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description="Quem já veio ao evento e quem já comprou este ano. Comece por quem ainda não comprou: essas pessoas já conhecem o evento."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap items-center gap-0.5 rounded-[18px] border bg-secondary p-1">
          {botao("nao", "Ainda não compraram")}
          {botao("sim", "Já compraram")}
          {botao("todos", "Todos")}
        </div>
        <Input
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setLimite(PAGE); }}
          placeholder="Buscar por nome, e-mail, telefone ou empresa"
          className="h-10 max-w-sm rounded-full"
        />
      </div>

      {dados.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {lista.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Ninguém encontrado com esse filtro.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Eventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.slice(0, limite).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {p.name}
                            {p.comprou ? <Chip variant="ok">Já comprou</Chip> : <Chip variant="warn">Ainda não</Chip>}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate" title={p.emails.join(", ")}>
                          {p.emails[0] ? <a href={`mailto:${p.emails[0]}`} className="hover:underline">{p.emails[0]}</a> : "—"}
                          {p.emails.length > 1 && <span className="text-muted-foreground"> +{p.emails.length - 1}</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {p.phones[0] ? (
                            <a href={`https://wa.me/55${p.phones[0]}`} target="_blank" rel="noreferrer" className="hover:underline" title="Abrir no WhatsApp">
                              {formatPhone(p.phones[0])}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.companies[0] ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {anos.map((ano) =>
                            Object.values(p.events).some((e) => e.event.year === ano) ? (
                              <Chip key={ano} variant="neutral" dot={false} className="mr-1">{ano}</Chip>
                            ) : null,
                          )}
                        </TableCell>
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
        </>
      )}
    </div>
  );
}
