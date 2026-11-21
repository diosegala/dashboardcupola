import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { traduzirErro } from "@/lib/mensagensErro";
import {
  CATEGORIAS, PAPEIS, PERIODOS, filtroParaBanco, filtrosDaUrl, formatarQuando, gerarCsv, nomeCategoria, nomeProcesso,
  quem, relativo, resumoLinha, rotuloRegistro, urlDosFiltros, type ChaveFiltro, type Filtros, type LogLinha, type Periodo,
} from "@/lib/activityLog";
import { TomAcao } from "@/components/auditoria/TomAcao";
import { LogDetailSheet } from "@/components/auditoria/LogDetailSheet";

const POR_PAGINA = 50;
const TODOS = "__todos";

interface Pessoa { chave: string; nome: string | null; email: string | null; papel: string | null; processo: string | null; tipo: "ativo" | "removido" | "automacao" | "nao_confirmado" }
interface Opcoes { pessoas: Pessoa[]; eventos: { id: string; nome: string | null }[]; telas: string[] }
interface Resumo { total: number; exclusoes: number; permissoes: number; falhas: number }
interface Saude { sem_auditoria: string[]; erros: number; ultimo_erro: { quando: string; tabela: string; mensagem: string } | null }

const RESULTADOS = [{ value: "sucesso", label: "Sucesso" }, { value: "erro", label: "Erro" }];

function rotuloPessoa(p: Pessoa) {
  if (p.tipo === "automacao") return nomeProcesso(p.processo);
  return p.nome || p.email || "Sem nome";
}

export default function Logs() {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => filtrosDaUrl(params), [params]);
  const chave = urlDosFiltros(filtros).toString();
  const filtroBanco = useMemo(() => filtroParaBanco(filtros, new Date()), [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState<LogLinha | null>(null);
  const [novos, setNovos] = useState<Set<number>>(new Set());
  const [agora, setAgora] = useState(Date.now());
  const [busca, setBusca] = useState(filtros.valores.busca ?? "");
  const [exportando, setExportando] = useState(false);

  const mudar = (f: Filtros) => setParams(urlDosFiltros(f), { replace: true });
  const definir = (k: ChaveFiltro, v: string | undefined) => {
    const valores = { ...filtros.valores };
    if (v) valores[k] = v; else delete valores[k];
    mudar({ ...filtros, valores });
  };

  // Busca livre vai para o endereço depois de uma pausa na digitação.
  useEffect(() => setBusca(filtros.valores.busca ?? ""), [filtros.valores.busca]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((filtros.valores.busca ?? "") !== busca.trim()) definir("busca", busca.trim() || undefined);
    }, 400);
    return () => window.clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useInfiniteQuery({
    queryKey: ["logs", chave],
    initialPageParam: null as null | { em: string; id: number },
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("logs_buscar", {
        f: filtroBanco as Json,
        p_antes_em: pageParam?.em,
        p_antes_id: pageParam?.id,
        p_limite: POR_PAGINA,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LogLinha[];
    },
    getNextPageParam: (ultima) => (ultima.length === POR_PAGINA ? { em: ultima[ultima.length - 1].ocorrido_em, id: ultima[ultima.length - 1].id } : undefined),
    staleTime: 15_000,
  });

  const resumo = useQuery({
    queryKey: ["logs-resumo", chave],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("logs_resumo", { f: filtroBanco as Json });
      if (error) throw error;
      return data as unknown as Resumo;
    },
    staleTime: 15_000,
  });

  const opcoes = useQuery({
    queryKey: ["logs-opcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("logs_opcoes");
      if (error) throw error;
      return data as unknown as Opcoes;
    },
    staleTime: 60_000,
  });

  const saude = useQuery({
    queryKey: ["logs-saude"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("logs_saude");
      if (error) throw error;
      return data as unknown as Saude;
    },
    staleTime: 60_000,
  });

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["logs"] });
    queryClient.invalidateQueries({ queryKey: ["logs-resumo"] });
    queryClient.invalidateQueries({ queryKey: ["logs-opcoes"] });
    queryClient.invalidateQueries({ queryKey: ["logs-saude"] });
  };

  // Ao vivo: cada registro novo avisa a tela, que relê a lista e marca a linha como "novo".
  const espera = useRef<number>();
  useEffect(() => {
    const canal = supabase
      .channel(`logs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_atividade" }, (payload) => {
        const id = Number((payload.new as { id?: number }).id);
        if (id) setNovos((s) => new Set(s).add(id));
        window.clearTimeout(espera.current);
        espera.current = window.setTimeout(atualizar, 1200);
      })
      .subscribe();
    return () => {
      window.clearTimeout(espera.current);
      supabase.removeChannel(canal);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const linhas = useMemo(() => lista.data?.pages.flat() ?? [], [lista.data]);
  const pessoas = opcoes.data?.pessoas ?? [];
  const grupos: { tipo: Pessoa["tipo"]; titulo: string }[] = [
    { tipo: "ativo", titulo: "Ativos" }, { tipo: "removido", titulo: "Removidos" },
    { tipo: "automacao", titulo: "Automações" }, { tipo: "nao_confirmado", titulo: "Não confirmados" },
  ];

  const chips: { k: ChaveFiltro; texto: string }[] = [];
  const v = filtros.valores;
  if (v.pessoa) { const p = pessoas.find((x) => x.chave === v.pessoa); chips.push({ k: "pessoa", texto: `Pessoa: ${p ? rotuloPessoa(p) : "selecionada"}` }); }
  if (v.papel) chips.push({ k: "papel", texto: `Função: ${PAPEIS.find((p) => p.value === v.papel)?.label ?? v.papel}` });
  if (v.categoria) chips.push({ k: "categoria", texto: `Categoria: ${nomeCategoria(v.categoria)}` });
  if (v.tela) chips.push({ k: "tela", texto: `Tela: ${v.tela}` });
  if (v.evento) chips.push({ k: "evento", texto: `Evento: ${opcoes.data?.eventos.find((e) => e.id === v.evento)?.nome ?? "selecionado"}` });
  if (v.resultado) chips.push({ k: "resultado", texto: `Resultado: ${v.resultado === "erro" ? "Erro" : "Sucesso"}` });
  if (v.busca) chips.push({ k: "busca", texto: `Busca: ${v.busca}` });
  if (v.entidade) chips.push({ k: "entidade", texto: `Vida do registro: ${linhas.find((l) => l.entidade === v.entidade && (!v.entidade_id || l.entidade_id === v.entidade_id))?.entidade_rotulo ?? "selecionado"}` });

  const tirarChip = (k: ChaveFiltro) => {
    const valores = { ...filtros.valores };
    delete valores[k];
    if (k === "entidade") delete valores.entidade_id;
    mudar({ ...filtros, valores });
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const { data, error } = await supabase.rpc("exportar_logs", { f: filtroBanco as Json });
      if (error) throw error;
      const rows = (data ?? []) as unknown as LogLinha[];
      const blob = new Blob([gerarCsv(rows)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `logs-cupola-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${rows.length} registros exportados`, { description: "A exportação também ficou registrada no log." });
    } catch (err) {
      toast.error("Não foi possível exportar", { description: traduzirErro(err as Error) });
    } finally {
      setExportando(false);
    }
  };

  const alertas = saude.data && (saude.data.sem_auditoria.length > 0 || saude.data.erros > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Logs"
        description="Quem fez o quê, onde e quando, em todas as telas do painel. Ninguém edita nem apaga estes registros."
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {lista.dataUpdatedAt ? `Atualizado ${relativo(lista.dataUpdatedAt, agora)}` : ""}
            </span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setNovos(new Set()); atualizar(); }} disabled={lista.isFetching}>
              <RefreshCw className={cn("h-4 w-4", lista.isFetching && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={exportar} disabled={exportando || !resumo.data?.total}>
              {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar CSV
            </Button>
          </>
        }
      />

      {alertas && (
        <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-4 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {saude.data!.sem_auditoria.length > 0 && <p><b>Tabelas sem registro de atividade:</b> {saude.data!.sem_auditoria.join(", ")}. O que mudar nelas não aparece aqui.</p>}
            {saude.data!.erros > 0 && (
              <p>
                <b>O log falhou {saude.data!.erros} {saude.data!.erros === 1 ? "vez" : "vezes"}.</b> A ação da pessoa seguiu normalmente, mas o registro não foi gravado.
                {saude.data!.ultimo_erro && <> Última: {formatarQuando(saude.data!.ultimo_erro.quando)} em {saude.data!.ultimo_erro.tabela} ({saude.data!.ultimo_erro.mensagem}).</>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quatro números do período e dos filtros, sem gráfico */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ["Registros", resumo.data?.total],
          ["Exclusões", resumo.data?.exclusoes],
          ["Mudanças de permissão", resumo.data?.permissoes],
          ["Falhas", resumo.data?.falhas],
        ] as const).map(([rotulo, n]) => (
          <Card key={rotulo} className="px-4 py-3">
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className={cn("text-2xl font-[650] tabular-nums", rotulo === "Falhas" && !!n && "text-bad")}>
              {resumo.isLoading ? <Skeleton className="mt-1 h-7 w-12" /> : resumo.isError ? "—" : (n ?? 0).toLocaleString("pt-BR")}
            </p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtros.periodo} onValueChange={(p) => mudar({ ...filtros, periodo: p as Periodo })}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {filtros.periodo === "personalizado" && (
            <>
              <Input type="date" aria-label="De" className="h-9 w-[150px]" value={filtros.de ?? ""} onChange={(e) => mudar({ ...filtros, de: e.target.value || undefined })} />
              <Input type="date" aria-label="Até" className="h-9 w-[150px]" value={filtros.ate ?? ""} onChange={(e) => mudar({ ...filtros, ate: e.target.value || undefined })} />
            </>
          )}
          <Select value={v.pessoa ?? TODOS} onValueChange={(x) => definir("pessoa", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Pessoa"><SelectValue placeholder="Pessoa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as pessoas</SelectItem>
              {grupos.map((g) => {
                const doGrupo = pessoas.filter((p) => p.tipo === g.tipo);
                if (!doGrupo.length) return null;
                return (
                  <SelectGroup key={g.tipo}>
                    <SelectLabel>{g.titulo}</SelectLabel>
                    {doGrupo.map((p) => <SelectItem key={p.chave} value={p.chave}>{rotuloPessoa(p)}</SelectItem>)}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={v.papel ?? TODOS} onValueChange={(x) => definir("papel", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Função"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as funções</SelectItem>
              {PAPEIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={v.categoria ?? TODOS} onValueChange={(x) => definir("categoria", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[190px]" aria-label="Categoria"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as categorias</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={v.tela ?? TODOS} onValueChange={(x) => definir("tela", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Tela"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as telas</SelectItem>
              {(opcoes.data?.telas ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={v.evento ?? TODOS} onValueChange={(x) => definir("evento", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Evento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os eventos</SelectItem>
              {(opcoes.data?.eventos ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome ?? "Evento"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={v.resultado ?? TODOS} onValueChange={(x) => definir("resultado", x === TODOS ? undefined : x)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Resultado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Sucesso e erro</SelectItem>
              {RESULTADOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar registro, e-mail ou campo" aria-label="Buscar" className="h-9 pl-9" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {resumo.data ? `${resumo.data.total.toLocaleString("pt-BR")} ${resumo.data.total === 1 ? "resultado" : "resultados"}` : " "}
          </span>
          {chips.map((c) => (
            <button key={c.k} type="button" onClick={() => tirarChip(c.k)} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs hover:bg-secondary/70" aria-label={`Remover filtro ${c.texto}`}>
              {c.texto} <X className="h-3 w-3" />
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => mudar({ periodo: filtros.periodo, de: filtros.de, ate: filtros.ate, valores: {} })}>
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {lista.isLoading ? (
          <div className="space-y-2 p-4" aria-label="Carregando">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : lista.isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center" role="alert">
            <AlertTriangle className="h-6 w-6 text-bad" />
            <p className="font-medium">Não foi possível carregar os logs.</p>
            <p className="max-w-md text-sm text-muted-foreground">{traduzirErro(lista.error as Error)}</p>
            <Button variant="outline" size="sm" onClick={() => lista.refetch()}>Tentar de novo</Button>
          </div>
        ) : linhas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <p className="font-medium">Nenhum registro para estes filtros.</p>
            <p className="text-sm text-muted-foreground">Tente outro período ou tire algum filtro.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Quando</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Onde</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead className="text-right">Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const q = quem(l);
                  return (
                    <TableRow
                      key={l.id}
                      className={cn("cursor-pointer text-[13px]", l.categoria === "permissao" && "bg-warn-bg/40 hover:bg-warn-bg/60")}
                      onClick={() => setAberto(l)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setAberto(l)}
                    >
                      <TableCell className="whitespace-nowrap py-2">
                        <Tooltip>
                          <TooltipTrigger asChild><span className="tabular-nums">{formatarQuando(l.ocorrido_em, true)}</span></TooltipTrigger>
                          <TooltipContent>{relativo(l.ocorrido_em, agora)}</TooltipContent>
                        </Tooltip>
                        {novos.has(l.id) && <Badge variant="secondary" className="ml-1.5 bg-primary/20 px-1.5 py-0 text-[10px] text-foreground">novo</Badge>}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="font-medium">{q.nome}</span>
                        {l.actor_removido && <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px] text-muted-foreground">acesso removido</Badge>}
                        {q.detalhe && <span className="block text-[11px] text-muted-foreground">{q.detalhe}</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        <TomAcao acao={l.acao} />
                        {l.resultado === "erro" && <Badge variant="secondary" className="ml-1.5 bg-bad-bg px-1.5 py-0 text-[10px] text-bad hover:bg-bad-bg">erro</Badge>}
                        {l.categoria === "permissao" && <span className="block text-[11px] font-medium text-warn">Permissão</span>}
                      </TableCell>
                      <TableCell className="max-w-[260px] py-2">
                        <span className="block truncate">{rotuloRegistro(l) ?? "—"}</span>
                        {l.tela && <span className="block truncate text-[11px] text-muted-foreground">{l.tela}</span>}
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">{l.event_nome ?? "—"}</TableCell>
                      <TableCell className="py-2 text-right text-muted-foreground">{resumoLinha(l)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {lista.hasNextPage && (
              <div className="flex justify-center border-t p-3">
                <Button variant="outline" size="sm" onClick={() => lista.fetchNextPage()} disabled={lista.isFetchingNextPage}>
                  {lista.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar mais"}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <LogDetailSheet
        log={aberto}
        onClose={() => setAberto(null)}
        onFiltrarRegistro={(l) => {
          setAberto(null);
          mudar({ periodo: "tudo", valores: { entidade: l.entidade, ...(l.entidade_id ? { entidade_id: l.entidade_id } : {}) } });
        }}
        onFiltrarPessoa={(l) => {
          setAberto(null);
          const chaveP = l.actor_id ?? (l.actor_processo ? `proc:${l.actor_processo}` : l.actor_email ? `email:${l.actor_email}` : undefined);
          mudar({ ...filtros, valores: chaveP ? { pessoa: chaveP } : {} });
        }}
      />
    </div>
  );
}
