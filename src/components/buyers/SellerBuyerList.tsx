import { useEffect, useMemo, useState } from "react";
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
import { buildBuyers, eventRef, type DetailRow } from "@/lib/buyers";
import { cn } from "@/lib/utils";

const int = (n: number) => n.toLocaleString("pt-BR");
const PAGE = 100;

type Filtro = "nao" | "sim" | "todos";

// Lista enxuta para a equipe de vendas: quem já veio e quem já comprou, para abordar quem ainda não comprou.
// Os dados vêm de uma função do banco que entrega só nome, empresa e situação. E-mail e telefone chegam como
// chaves secretas: servem para achar quem a equipe já conhece (digitando o contato), nunca para mostrar.
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

  // Parece e-mail ou telefone? Pede ao banco a chave do que foi digitado (espera a digitação parar).
  const pareceContato = termo.includes("@") || termo.replace(/\D/g, "").length >= 10;
  const [termoContato, setTermoContato] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setTermoContato(pareceContato ? termo : ""), 400);
    return () => clearTimeout(id);
  }, [termo, pareceContato]);
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
  const chavesBusca = pareceContato && termoContato === termo ? chaves.data ?? [] : [];
  const contatoConfere = (p: { emails: string[]; phones: string[] }) => chavesBusca.some((k) => p.emails.includes(k) || p.phones.includes(k));
  const lista = useMemo(
    () =>
      pessoas
        // Buscando, procura em todos; sem busca, vale o filtro escolhido.
        .filter((p) => !!termo || filtro === "todos" || (filtro === "sim") === p.comprou)
        .filter(
          (p) =>
            !termo ||
            (pareceContato
              ? contatoConfere(p)
              : p.name.toLowerCase().includes(termo) || p.companies.some((c) => c.toLowerCase().includes(termo))),
        )
        .sort((a, b) => Object.keys(b.events).length - Object.keys(a.events).length || a.name.localeCompare(b.name, "pt-BR")),
    [pessoas, filtro, termo, pareceContato, chavesBusca.join("|")],
  );

  const botao = (f: Filtro, rotulo: string) => (
    <button
      type="button"
      onClick={() => { setFiltro(f); setLimite(PAGE); }}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
        filtro === f && !termo ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
          placeholder="Buscar por nome, empresa, e-mail ou telefone"
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
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {pareceContato
                    ? chaves.isFetching || termoContato !== termo
                      ? "Procurando…"
                      : "Ninguém com esse e-mail ou telefone nos eventos."
                    : "Ninguém encontrado com esse filtro."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
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
                            {pareceContato && contatoConfere(p) && <Chip variant="blue">Contato confere</Chip>}
                          </span>
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
