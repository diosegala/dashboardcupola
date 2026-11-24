import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ArrowLeft, History, Loader2, Search, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { traduzirErro } from "@/lib/mensagensErro";
import {
  CATEGORIAS, PAPEIS, PERIODOS, filtroParaBanco, filtrosDaUrl, formatarQuando, narrativa, nomeCategoria, nomeProcesso,
  quem, relativo, rotuloRegistro, urlDosFiltros, type ChaveFiltro, type Filtros, type LogLinha, type Periodo,
} from "@/lib/activityLog";
import { TomAcao } from "@/components/auditoria/TomAcao";
import { LogDetailSheet } from "@/components/auditoria/LogDetailSheet";

const POR_PAGINA = 50;
const TODOS = "__todos";

interface Pessoa { chave: string; nome: string | null; email: string | null; papel: string | null; processo: string | null; tipo: "ativo" | "removido" | "automacao" | "nao_confirmado" }
interface Opcoes { pessoas: Pessoa[]; eventos: { id: string; nome: string | null }[]; telas: string[] }
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
  const [agora, setAgora] = useState(Date.now());
  const [busca, setBusca] = useState(filtros.valores.busca ?? "");

  const aba = filtros.valores.papel === "automacao" ? "automacoes" : "pessoas";
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
      // Aba Pessoas: só ações de gente (cada função consultada à parte e juntada pela data).
      const papeis = aba === "automacoes" || filtroBanco.pessoa ? [filtroBanco.papel] : ["admin", "viewer", "seller"];
      const partes = await Promise.all(papeis.map(async (papel) => {
        const { data, error } = await supabase.rpc("logs_buscar", {
          f: { ...filtroBanco, ...(papel ? { papel } : {}) } as Json,
          p_antes_em: pageParam?.em,
          p_antes_id: pageParam?.id,
          p_limite: POR_PAGINA,
        });
        if (error) throw error;
        return (data ?? []) as unknown as LogLinha[];
      }));
      return partes.flat().sort((x, y) => (y.ocorrido_em.localeCompare(x.ocorrido_em)) || y.id - x.id).slice(0, POR_PAGINA);
    },
    getNextPageParam: (ultima) => (ultima.length === POR_PAGINA ? { em: ultima[ultima.length - 1].ocorrido_em, id: ultima[ultima.length - 1].id } : undefined),
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
    queryClient.invalidateQueries({ queryKey: ["logs-opcoes"] });
    queryClient.invalidateQueries({ queryKey: ["logs-saude"] });
  };

  // Ao vivo: cada registro novo avisa a tela, que relê a lista.
  const espera = useRef<number>();
  useEffect(() => {
    const canal = supabase
      .channel(`logs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs_atividade" }, () => {
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
  if (false && v.papel) chips.push({ k: "papel", texto: `Função: ${PAPEIS.find((p) => p.value === v.papel)?.label ?? v.papel}` });
  if (v.categoria) chips.push({ k: "categoria", texto: `Categoria: ${nomeCategoria(v.categoria)}` });
  if (v.tela) chips.push({ k: "tela", texto: `Tela: ${v.tela}` });
  if (v.evento) chips.push({ k: "evento", texto: `Evento: ${opcoes.data?.eventos.find((e) => e.id === v.evento)?.nome ?? "selecionado"}` });
  if (v.resultado) chips.push({ k: "resultado", texto: `Resultado: ${v.resultado === "erro" ? "Erro" : "Sucesso"}` });
  if (v.busca) chips.push({ k: "busca", texto: `Busca: ${v.busca}` });

  const tirarChip = (k: ChaveFiltro) => {
    const valores = { ...filtros.valores };
    delete valores[k];
    if (k === "entidade") delete valores.entidade_id;
    mudar({ ...filtros, valores });
  };

  const alertas = saude.data && (saude.data.sem_auditoria.length > 0 || saude.data.erros > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Logs"
        description="Quem fez o quê, onde e quando, em todas as telas do painel. Ninguém edita nem apaga estes registros."
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

      <div className="inline-flex w-fit items-center gap-0.5 rounded-[18px] border bg-secondary p-1" role="tablist">
        {([["pessoas", "O que as pessoas fizeram"], ["automacoes", "Automações"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k}
            onClick={() => { const valores = { ...filtros.valores }; delete valores.pessoa; delete valores.papel; if (k === "automacoes") valores.papel = "automacao"; mudar({ ...filtros, valores }); }}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", aba === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
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
              <SelectItem value={TODOS}>{aba === "automacoes" ? "Todas as automações" : "Todas as pessoas"}</SelectItem>
              {grupos.map((g) => {
                if ((aba === "automacoes") !== (g.tipo === "automacao")) return null;
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
          <Button type="button" variant={v.resultado === "erro" ? "default" : "outline"} size="sm" className="h-9" onClick={() => definir("resultado", v.resultado === "erro" ? undefined : "erro")}>
            Só falhas
          </Button>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar" className="h-9 pl-9" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {lista.data ? `${linhas.length.toLocaleString("pt-BR")}${lista.hasNextPage ? "+" : ""} ${linhas.length === 1 ? "registro" : "registros"}` : " "}
          </span>
          {chips.map((c) => (
            <button key={c.k} type="button" onClick={() => tirarChip(c.k)} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs hover:bg-secondary/70" aria-label={`Remover filtro ${c.texto}`}>
              {c.texto} <X className="h-3 w-3" />
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => mudar({ periodo: filtros.periodo, de: filtros.de, ate: filtros.ate, valores: aba === "automacoes" ? { papel: "automacao" } : {} })}>
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {(v.entidade || v.pessoa) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-bg-alt/60 px-4 py-3 text-sm">
          {v.entidade ? <History className="h-4 w-4 text-data-blue" /> : <Workflow className="h-4 w-4 text-data-blue" />}
          <span>
            <span className="text-muted-foreground">{v.entidade ? "Vida do registro: " : "Tudo de: "}</span>
            <b>{v.entidade
              ? (rotuloRegistro(linhas.find((l) => l.entidade === v.entidade && (!v.entidade_id || l.entidade_id === v.entidade_id)) ?? { entidade: v.entidade, entidade_rotulo: null }) ?? "registro")
              : (() => { const p = pessoas.find((x) => x.chave === v.pessoa); return p ? rotuloPessoa(p) : "selecionado"; })()}</b>
            <span className="text-muted-foreground"> · {linhas.length}{lista.hasNextPage ? "+" : ""} {linhas.length === 1 ? "registro" : "registros"}, do mais novo ao mais antigo</span>
          </span>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => { const valores = { ...filtros.valores }; delete valores.entidade; delete valores.entidade_id; delete valores.pessoa; mudar({ ...filtros, valores }); }}>
            <ArrowLeft className="h-4 w-4" /> Voltar a todos
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        {lista.isLoading ? (
          <div className="space-y-2 p-4" aria-label="Carregando">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : lista.isError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center" role="alert">
            <AlertTriangle className="h-6 w-6 text-data-blue" />
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[104px]">Quando</TableHead>
                  <TableHead className="w-[24%]">Quem</TableHead>
                  <TableHead>O que aconteceu</TableHead>
                  <TableHead className="w-[52px]"><span className="sr-only">Histórico</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const q = quem(l);
                  const n = narrativa(l);
                  const onde = [l.tela, l.event_nome].filter(Boolean).join(" · ");
                  const vida = !!l.entidade_id && !v.entidade;
                  const automacao = q.automacao && !v.pessoa && !!l.actor_processo;
                  return (
                    <TableRow
                      key={l.id}
                      className={cn("cursor-pointer text-[13px]", l.categoria === "permissao" && "bg-warn-bg/40 hover:bg-warn-bg/60")}
                      onClick={() => setAberto(l)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setAberto(l)}
                    >
                      <TableCell className="whitespace-nowrap py-3 align-top">
                        <Tooltip>
                          <TooltipTrigger asChild><span className="tabular-nums">{formatarQuando(l.ocorrido_em, true)}</span></TooltipTrigger>
                          <TooltipContent>{relativo(l.ocorrido_em, agora)}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="max-w-0 py-3 align-top">
                        <span className="line-clamp-2 break-words font-medium" title={q.nome}>{q.nome}</span>
                        <span className="block break-words text-xs text-muted-foreground">
                          {[q.detalhe, l.actor_removido ? "acesso removido" : null].filter(Boolean).join(" · ")}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0 py-3 align-top">
                        <TomAcao acao={l.acao} erro={l.resultado === "erro"} texto={n.titulo} />
                        {n.detalhe.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-3 text-foreground/80">
                            {n.detalhe.slice(0, 3).map((d, i) => <li key={i} className="break-words">{d}</li>)}
                            {n.detalhe.length > 3 && <li className="text-xs text-muted-foreground">e mais {n.detalhe.length - 3} — clique para ver tudo</li>}
                          </ul>
                        )}
                        {onde && <span className="mt-1 block truncate pl-3 text-xs text-muted-foreground">{onde}</span>}
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        {(vida || automacao) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8"
                                aria-label={vida ? "Ver a vida deste registro" : "Ver tudo desta automação"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (vida) mudar({ periodo: "tudo", valores: { entidade: l.entidade, entidade_id: l.entidade_id! } });
                                  else mudar({ ...filtros, valores: { papel: "automacao", pessoa: `proc:${l.actor_processo}` } });
                                }}
                              >
                                {vida ? <History className="h-4 w-4" /> : <Workflow className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{vida ? "Ver a vida deste registro" : "Ver tudo desta automação"}</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
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
