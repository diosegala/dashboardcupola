import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllTimeTicketSales } from "@/hooks/useDashboardData";
import { splitTickets } from "@/hooks/useCommercialMetrics";
import { COUPON_PEOPLE_KEY } from "@/hooks/useCouponPeople";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Link2, Loader2, Upload } from "lucide-react";
import { ADMIN_ROLE, ROLES } from "@/lib/roles";
import { EVENT_ACCESS_KEY } from "@/lib/eventAccess";
import { traduzirErro } from "@/lib/mensagensErro";
import { lerXlsx } from "@/lib/xlsx";
import {
  CAMPOS, combinarColunas, conferir, funcoesAceitas, lerCsv, montarLinhas, resumo,
  type Base, type Campo, type Decisao, type FichaBase, type Problema, type Resultado,
} from "@/lib/userImport";
import { executarImportacao, type Falha } from "@/lib/userImportRun";

// Modelo no Google Sheets (Arquivo › Fazer uma cópia). Vazio = só o arquivo para baixar.
export const MODELO_GOOGLE = "";

const MODELO_CSV = "﻿Nome*;Sobrenome*;E-mail*;Função*;Cupons\nMaria;Exemplo;maria@exemplo.com;Visualizador;MARIA5\nJoão;Exemplo;joao@exemplo.com;Ranking;JOAO5, JOAO10\n";

function baixarModelo() {
  const url = URL.createObjectURL(new Blob([MODELO_CSV], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-pessoas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Link do Google Sheets → tabela. A planilha precisa estar como "Qualquer pessoa com o link: Leitor".
async function lerGoogleSheets(link: string): Promise<string[][]> {
  const id = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) throw new Error("Esse link não parece ser de uma planilha do Google.");
  const gid = link.match(/[#&?]gid=(\d+)/)?.[1];
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1${gid ? `&gid=${gid}` : ""}`;
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    throw new Error("Não consegui abrir a planilha. Confira se ela está compartilhada como \"Qualquer pessoa com o link: Leitor\".");
  }
  const texto = await resp.text();
  if (!resp.ok || /^\s*<(!doctype|html)/i.test(texto)) {
    throw new Error("A planilha não está aberta para leitura. Compartilhe como \"Qualquer pessoa com o link: Leitor\" e tente de novo.");
  }
  return lerCsv(texto);
}

type Etapa = "origem" | "colunas" | "conferencia" | "executando" | "relatorio";

interface Props {
  event: { id: string; name: string; sympla_event_id: string | null } | null;
  onClose: () => void;
}

export function ImportPeopleDialog({ event, onClose }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("origem");
  const [origem, setOrigem] = useState("");
  const [link, setLink] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tabela, setTabela] = useState<string[][]>([]);
  const [combinacao, setCombinacao] = useState<(Campo | null)[]>([]);
  const [base, setBase] = useState<Base | null>(null);
  const [decisoes, setDecisoes] = useState<Record<number, Decisao>>({});
  const [instrucoes, setInstrucoes] = useState(false);
  const [transferir, setTransferir] = useState<{ linha: number; prob: Extract<Problema, { tipo: "cupom_de_outro" }>; nome: string } | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [relatorio, setRelatorio] = useState<{ totais: ReturnType<typeof resumo>; falhas: Falha[]; naoEntraram: Falha[]; historicoSalvo: boolean } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const vendas = useAllTimeTicketSales(event?.sympla_event_id ?? "");

  const linhas = useMemo(() => (tabela.length ? montarLinhas(tabela, combinacao) : []), [tabela, combinacao]);
  const resultados = useMemo(() => (base ? conferir(linhas, base, decisoes) : []), [linhas, base, decisoes]);
  const totais = resumo(resultados);
  const pendentes = resultados.filter((r) => r.pendentes.length);
  const decididas = resultados.filter((r) => r.resolvidos.length && !r.pendentes.length);

  const fechar = () => {
    if (etapa === "executando") return;
    setEtapa("origem"); setOrigem(""); setLink(""); setErro(null); setTabela([]); setCombinacao([]);
    setBase(null); setDecisoes({}); setRelatorio(null); setProgresso(0);
    onClose();
  };

  const carregarTabela = (t: string[][], nome: string) => {
    const semVazias = t.filter((row) => row.some((c) => String(c ?? "").trim()));
    if (semVazias.length < 2) throw new Error("A planilha não tem linhas para importar abaixo dos títulos.");
    if (semVazias.length > 501) throw new Error("A planilha tem mais de 500 linhas. Divida em partes menores.");
    setTabela(semVazias);
    setCombinacao(combinarColunas(semVazias[0].map((c) => String(c ?? ""))));
    setOrigem(nome);
    setEtapa("colunas");
  };

  const lerArquivo = async (f: File) => {
    setErro(null); setLendo(true);
    try {
      const t = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : lerCsv(await f.text());
      carregarTabela(t, f.name);
    } catch (e) {
      setErro((e as Error).message || "Não consegui ler o arquivo.");
    } finally {
      setLendo(false);
    }
  };

  const lerLink = async () => {
    setErro(null); setLendo(true);
    try {
      carregarTabela(await lerGoogleSheets(link.trim()), link.trim());
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLendo(false);
    }
  };

  // Base atual: pessoas, papéis, acessos, fichas de cupom e vendas por cupom do evento.
  const conferirPlanilha = async () => {
    setErro(null); setLendo(true);
    try {
      const [lista, papeis, escopos, ligacoes, fichasRes] = await Promise.all([
        supabase.functions.invoke("manage-user", { body: { action: "list_users" } }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_event_scope" as any).select("user_id, all_events"),
        supabase.from("event_users" as any).select("event_id, user_id"),
        supabase.from("coupon_people" as any).select("id, name, codes, user_id"),
      ]);
      if (lista.error || lista.data?.error) throw new Error(lista.error?.message ?? lista.data.error);
      const { data: perfis } = await supabase.from("profiles").select("id, name");
      const papelDe = new Map((papeis.data ?? []).map((r) => [r.user_id, String(r.role)]));
      const nomeDe = new Map((perfis ?? []).map((p) => [p.id, p.name]));
      const acesso = new Map<string, { allEvents: boolean; eventIds: string[] }>();
      const pega = (id: string) => acesso.get(id) ?? (acesso.set(id, { allEvents: false, eventIds: [] }), acesso.get(id)!);
      ((escopos.data ?? []) as any[]).forEach((s) => (pega(s.user_id).allEvents = s.all_events));
      ((ligacoes.data ?? []) as any[]).forEach((l) => pega(l.user_id).eventIds.push(l.event_id));
      const vendasPorCupom = new Map<string, number>();
      splitTickets(vendas.data ?? []).paying.forEach((t) => {
        const c = String(t.coupon_code ?? "").trim().toUpperCase();
        if (c) vendasPorCupom.set(c, (vendasPorCupom.get(c) ?? 0) + (t.quantity || 0));
      });
      setBase({
        pessoas: (lista.data?.users ?? []).map((u: any) => ({ id: u.id, email: u.email ?? "", name: nomeDe.get(u.id) ?? u.name ?? null, role: papelDe.get(u.id) ?? "viewer", disabled: !!u.disabled })),
        acesso,
        fichas: ((fichasRes.data ?? []) as any[]).map((f) => ({ id: f.id, name: f.name, codes: f.codes ?? [], userId: f.user_id })),
        vendasPorCupom,
        eventId: event!.id,
        adminRole: ADMIN_ROLE,
      });
      setEtapa("conferencia");
    } catch (e) {
      setErro(traduzirErro(e as Error));
    } finally {
      setLendo(false);
    }
  };

  const decidir = (linha: number, d: Partial<Decisao>) =>
    setDecisoes((atual) => ({ ...atual, [linha]: { ...atual[linha], ...d, cupons: { ...atual[linha]?.cupons, ...d.cupons }, edicao: { ...atual[linha]?.edicao, ...d.edicao } } }));
  const desfazer = (linha: number) => setDecisoes((atual) => { const n = { ...atual }; delete n[linha]; return n; });

  const importar = async () => {
    if (!base || !event || !user) return;
    const prontas = resultados.filter((r) => r.plano && (r.situacao === "nova" || r.situacao === "existente"));
    setEtapa("executando"); setProgresso(0);
    const fichas: FichaBase[] = base.fichas.map((f) => ({ ...f, codes: [...f.codes] }));
    const { falhas } = await executarImportacao(prontas, event.id, fichas, (n) => setProgresso(Math.round((n / Math.max(prontas.length, 1)) * 100)));
    const naoEntraram: Falha[] = resultados
      .filter((r) => r.situacao === "ignorada" || r.situacao === "repetida")
      .map((r) => ({ linha: r.linha, nome: r.nome, motivo: r.situacao === "repetida" ? `E-mail repetido (vale a linha ${r.repetidaDe})` : "Ignorada na conferência" }));
    const decisoesTomadas = resultados.flatMap((r) => [
      ...(r.plano?.transferencias ?? []).map((t) => ({ tipo: "transferencia", linha: r.linha, para: r.nome, cupom: t.codigo, de: t.dono, vendas: t.vendas, donoFicouSemCupom: t.donoFicaSemCupom })),
      ...(r.plano?.reativar ? [{ tipo: "reativacao", linha: r.linha, pessoa: r.nome }] : []),
    ]);
    const totaisFinais = { ...totais, falharam: falhas.length };
    const { error } = await supabase.from("user_imports" as any).insert({
      event_id: event.id, created_by: user.id, source: origem, totals: totaisFinais, issues: [...falhas, ...naoEntraram], decisions: decisoesTomadas,
    });
    setRelatorio({ totais: totaisFinais, falhas, naoEntraram, historicoSalvo: !error });
    ["users-with-roles", "user-imports"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    queryClient.invalidateQueries({ queryKey: EVENT_ACCESS_KEY });
    queryClient.invalidateQueries({ queryKey: COUPON_PEOPLE_KEY });
    queryClient.invalidateQueries({ queryKey: ["team_coupons"] });
    setEtapa("relatorio");
  };

  const emailMapeado = combinacao.includes("email");
  const camposSemColuna = CAMPOS.filter((c) => !combinacao.includes(c.id)).map((c) => c.titulo);

  return (
    <>
      <Dialog open={!!event} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Importar pessoas · {event?.name}</DialogTitle>
            <DialogDescription>
              Quem está na planilha ganha acesso a este evento. Quem não está não muda. Nada é gravado antes da conferência.
            </DialogDescription>
          </DialogHeader>

          {etapa === "origem" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <button type="button" onClick={baixarModelo} className="inline-flex items-center gap-1 underline-offset-4 hover:underline"><Download className="h-4 w-4" /> Baixar modelo</button>
                {MODELO_GOOGLE && <a href={MODELO_GOOGLE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline"><FileSpreadsheet className="h-4 w-4" /> Modelo no Google Sheets</a>}
                <button type="button" onClick={() => setInstrucoes(true)} className="text-muted-foreground underline-offset-4 hover:underline">Como preencher a planilha</button>
              </div>
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                disabled={lendo}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Upload className="h-5 w-5" />
                <span><b className="text-foreground">Escolher arquivo</b> .xlsx ou .csv</span>
              </button>
              <input ref={arquivoRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); e.target.value = ""; }} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ou cole o link da planilha do Google (compartilhada como "Qualquer pessoa com o link: Leitor")</p>
                <div className="flex gap-2">
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  <Button type="button" variant="outline" onClick={lerLink} disabled={lendo || !link.trim()} className="gap-1"><Link2 className="h-4 w-4" /> Ler</Button>
                </div>
              </div>
              {lendo && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo a planilha…</p>}
              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>
          )}

          {etapa === "colunas" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Confira a qual campo cada coluna corresponde. Colunas com o título do modelo já vêm combinadas.</p>
              <div className="divide-y rounded-2xl border">
                {tabela[0].map((titulo, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{String(titulo || `Coluna ${i + 1}`)}</p>
                      <p className="truncate text-xs text-muted-foreground">{String(tabela[1]?.[i] ?? "")}</p>
                    </div>
                    <Select
                      value={combinacao[i] ?? "__ignorar"}
                      onValueChange={(v) => setCombinacao((c) => c.map((x, j) => (j === i ? (v === "__ignorar" ? null : (v as Campo)) : x === v ? null : x)))}
                    >
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignorar">Ignorar</SelectItem>
                        {CAMPOS.map((c) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!emailMapeado && <p className="text-sm text-destructive">Escolha a coluna do E-mail: é ela que identifica cada pessoa.</p>}
              {emailMapeado && camposSemColuna.length > 0 && (
                <p className="text-xs text-muted-foreground">Sem coluna para: {camposSemColuna.join(", ")}. Pessoas novas vão precisar desses dados na conferência.</p>
              )}
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEtapa("origem")}>Voltar</Button>
                <Button onClick={conferirPlanilha} disabled={!emailMapeado || lendo || vendas.isLoading}>
                  {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferir"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {etapa === "conferencia" && (
            <div className="space-y-4">
              <Numeros totais={totais} />
              {pendentes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pendentes.length === 1 ? "1 linha precisa" : `${pendentes.length} linhas precisam`} da sua decisão</p>
                  {pendentes.map((r) => (
                    <Pendencia key={r.linha} r={r} onDecidir={(d) => decidir(r.linha, d)}
                      onTransferir={(prob) => setTransferir({ linha: r.linha, prob, nome: r.nome })} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{totais.prontas ? "Tudo certo para importar." : "Nada a mudar: a base já está como a planilha."}</p>
              )}
              {decididas.length > 0 && (
                <div className="space-y-1 rounded-2xl bg-secondary p-3 text-xs">
                  <p className="font-medium">Decisões tomadas</p>
                  {decididas.map((r) => (
                    <p key={r.linha} className="flex items-center gap-2">
                      <span className="flex-1">Linha {r.linha} · {r.nome}: {r.resolvidos.map(descreverDecisao).join(" · ")}</span>
                      <button type="button" className="underline-offset-2 hover:underline" onClick={() => desfazer(r.linha)}>Desfazer</button>
                    </p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEtapa("colunas")}>Voltar</Button>
                <Button onClick={importar} disabled={pendentes.length > 0 || totais.prontas === 0}>
                  Importar {totais.prontas ? `${totais.prontas} ${totais.prontas === 1 ? "pessoa" : "pessoas"}` : ""}
                </Button>
              </DialogFooter>
            </div>
          )}

          {etapa === "executando" && (
            <div className="space-y-3 py-4">
              <p className="text-sm">Importando… não feche esta janela.</p>
              <Progress value={progresso} />
            </div>
          )}

          {etapa === "relatorio" && relatorio && (
            <div className="space-y-4">
              <RelatorioDetalhe totais={relatorio.totais} problemas={[...relatorio.falhas, ...relatorio.naoEntraram]} />
              {!relatorio.historicoSalvo && <p className="text-xs text-muted-foreground">A importação foi feita, mas o histórico ainda não pôde ser salvo (falta criar a tabela no banco).</p>}
              <DialogFooter><Button onClick={fechar}>Concluir</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!transferir} onOpenChange={(o) => !o && setTransferir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir o cupom {transferir?.prob.codigo}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>O cupom sai de <b className="text-foreground">{transferir?.prob.dono}</b> e passa para <b className="text-foreground">{transferir?.nome}</b>.</p>
                {!!transferir?.prob.vendas && <p className="text-warn">As {transferir.prob.vendas} vendas já feitas com {transferir.prob.codigo} neste evento passam a contar para {transferir.nome} no ranking.</p>}
                {transferir?.prob.donoFicaSemCupom && <p className="text-warn">{transferir.prob.dono} vai ficar sem nenhum cupom.</p>}
                <p>Esta decisão fica registrada no histórico da importação, com o seu nome.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (transferir) decidir(transferir.linha, { cupons: { [transferir.prob.codigo]: { tipo: "transferir" } } }); setTransferir(null); }}>
              Confirmar transferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={instrucoes} onOpenChange={setInstrucoes}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>Como preencher a planilha</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            <p>Uma pessoa por linha, com os títulos na primeira linha. Apague as linhas de exemplo antes de subir.</p>
            <ul className="space-y-2">
              <li><b>Nome*</b> e <b>Sobrenome*</b>: separados, como a pessoa vai aparecer no painel.</li>
              <li><b>E-mail*</b>: é o que identifica a pessoa. Se já existir no painel, ela não é criada de novo.</li>
              <li><b>Função*</b>: {funcoesAceitas()}. Administrador não entra por planilha. Para quem já tem acesso, a função atual continua.</li>
              <li><b>Cupons</b>: os códigos da Sympla desta pessoa, separados por vírgula (ex.: ANA5, ANA10). Cada código é de uma só pessoa.</li>
            </ul>
            <p>O que acontece: quem é novo recebe convite e acesso a este evento. Quem já existe ganha este evento e os cupons que ainda não tem. Ninguém perde acesso nem muda de função.</p>
            <p className="text-muted-foreground">Planilha do Google: compartilhe como "Qualquer pessoa com o link: Leitor" e cole o link.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function descreverDecisao(p: Problema): string {
  if (p.tipo === "inativo") return "reativar";
  if (p.tipo === "cupom_repetido") return `${p.codigo} fica só na linha ${p.linhaOriginal}`;
  if (p.tipo === "cupom_de_outro") return `${p.codigo} decidido`;
  return "dados corrigidos";
}

function Numeros({ totais }: { totais: ReturnType<typeof resumo> & { falharam?: number } }) {
  const itens = [
    [totais.novas, totais.novas === 1 ? "convite novo" : "convites novos"],
    [totais.atualizadas, totais.atualizadas === 1 ? "já cadastrada ganha acesso ou cupom" : "já cadastradas ganham acesso ou cupom"],
    [totais.semMudanca, "sem nada a mudar"],
    [totais.ignoradas + totais.repetidas, "fora da importação"],
  ].filter(([n]) => (n as number) > 0);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-2xl bg-secondary px-4 py-3 text-sm">
      {itens.length ? itens.map(([n, t]) => <span key={t as string}><b>{n as number}</b> {t as string}</span>) : <span>Nenhuma linha para importar.</span>}
    </div>
  );
}

function Pendencia({ r, onDecidir, onTransferir }: {
  r: Resultado;
  onDecidir: (d: Partial<Decisao>) => void;
  onTransferir: (p: Extract<Problema, { tipo: "cupom_de_outro" }>) => void;
}) {
  const [outro, setOutro] = useState<Record<string, string>>({});
  return (
    <div className="space-y-2 rounded-2xl border p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">Linha {r.linha} · {r.nome || "sem nome"}{r.email && r.email !== r.nome ? <span className="font-normal text-muted-foreground"> · {r.email}</span> : null}</span>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => onDecidir({ ignorar: true })}>Ignorar linha</Button>
      </div>
      {r.pendentes.map((p, i) => {
        if (p.tipo === "dados") {
          return (
            <div key={i} className="space-y-2">
              <p className="text-xs text-destructive">{p.motivos.join(" · ")}</p>
              <div className="flex flex-wrap gap-2">
                {p.campos.map((c) => c === "role" ? (
                  <Select key={c} onValueChange={(v) => onDecidir({ edicao: { role: v } })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Função" /></SelectTrigger>
                    <SelectContent>{ROLES.filter((x) => x.importable).map((x) => <SelectItem key={x.value} value={x.label}>{x.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input key={c} className="h-8 w-48" placeholder={{ first: "Nome", last: "Sobrenome", email: "E-mail" }[c]}
                    onBlur={(e) => e.target.value.trim() && onDecidir({ edicao: { [c]: e.target.value } })}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                ))}
              </div>
            </div>
          );
        }
        if (p.tipo === "inativo") {
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-xs text-warn">Esta pessoa está inativa e não consegue entrar no painel.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => onDecidir({ reativar: true })}>Reativar</Button>
            </div>
          );
        }
        const codigo = p.codigo;
        return (
          <div key={i} className="space-y-2">
            <p className="text-xs text-warn">
              {p.tipo === "cupom_de_outro" ? `O cupom ${codigo} já é de ${p.dono}.` : `O cupom ${codigo} também está na linha ${p.linhaOriginal}.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-7" onClick={() => onDecidir({ cupons: { [codigo]: { tipo: "manter" } } })}>
                {p.tipo === "cupom_de_outro" ? `Manter com ${p.dono}` : `Deixar só na linha ${p.linhaOriginal}`}
              </Button>
              {p.tipo === "cupom_de_outro" && <Button size="sm" variant="outline" className="h-7" onClick={() => onTransferir(p)}>Transferir para esta pessoa</Button>}
              <Input className="h-7 w-32 font-mono uppercase placeholder:font-sans placeholder:normal-case" placeholder="Outro código" value={outro[codigo] ?? ""} onChange={(e) => setOutro((o) => ({ ...o, [codigo]: e.target.value.toUpperCase() }))} />
              <Button size="sm" variant="ghost" className="h-7" disabled={!outro[codigo]?.trim()} onClick={() => onDecidir({ cupons: { [codigo]: { tipo: "outro", codigo: outro[codigo] } } })}>Usar</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RelatorioDetalhe({ totais, problemas }: { totais: Record<string, number>; problemas: Falha[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-2xl bg-secondary px-4 py-3 text-sm">
        {totais.novas > 0 && <span><b>{totais.novas}</b> {totais.novas === 1 ? "convite enviado" : "convites enviados"}</span>}
        {totais.atualizadas > 0 && <span><b>{totais.atualizadas}</b> já {totais.atualizadas === 1 ? "cadastrada atualizada" : "cadastradas atualizadas"}</span>}
        {totais.semMudanca > 0 && <span><b>{totais.semMudanca}</b> sem nada a mudar</span>}
        {problemas.length > 0 && <span><b>{problemas.length}</b> não {problemas.length === 1 ? "entrou" : "entraram"}</span>}
      </div>
      {problemas.length > 0 && (
        <div className="divide-y rounded-2xl border text-sm">
          {problemas.map((f) => (
            <p key={`${f.linha}-${f.motivo}`} className="px-3 py-2"><b>Linha {f.linha}</b> · {f.nome} <span className="text-muted-foreground">· {f.motivo}</span></p>
          ))}
        </div>
      )}
    </div>
  );
}

interface Importacao { id: string; created_at: string; created_by: string; source: string; totals: Record<string, number>; issues: Falha[]; decisions: any[] }

// Histórico das importações do evento: resumo em uma linha; clicando, os detalhes do que não entrou e das decisões.
export function ImportHistory({ eventId, nomes }: { eventId: string; nomes: Map<string, string | null> }) {
  const [aberta, setAberta] = useState<Importacao | null>(null);
  const historico = useQuery({
    queryKey: ["user-imports", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_imports" as any).select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(20);
      if (error) return [] as Importacao[];
      return (data ?? []) as unknown as Importacao[];
    },
  });
  if (!historico.data?.length) return null;
  const quando = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Importações</p>
      {historico.data.map((h) => (
        <button key={h.id} type="button" onClick={() => setAberta(h)} className="block w-full rounded-xl px-2 py-1.5 text-left text-xs hover:bg-secondary">
          {quando(h.created_at)} · {nomes.get(h.created_by) ?? "administrador"} · {h.totals.novas ?? 0} novas · {h.totals.atualizadas ?? 0} atualizadas
          {h.issues?.length ? ` · ${h.issues.length} não entraram` : ""}
        </button>
      ))}
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Importação de {aberta && quando(aberta.created_at)}</DialogTitle>
            <DialogDescription>Por {aberta && (nomes.get(aberta.created_by) ?? "administrador")} · {aberta?.source}</DialogDescription>
          </DialogHeader>
          {aberta && <RelatorioDetalhe totais={aberta.totals} problemas={aberta.issues ?? []} />}
          {!!aberta?.decisions?.length && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Decisões confirmadas</p>
              {aberta.decisions.map((d, i) => (
                <p key={i} className="text-muted-foreground">
                  {d.tipo === "transferencia"
                    ? `Cupom ${d.cupom} transferido de ${d.de} para ${d.para}${d.vendas ? ` (${d.vendas} vendas mudaram de dono)` : ""}${d.donoFicouSemCupom ? `; ${d.de} ficou sem cupom` : ""}`
                    : `${d.pessoa} reativada`}
                </p>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
