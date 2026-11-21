import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, User } from "lucide-react";
import { comparacao, descreverAcao, rotuloRegistro, formatarQuando, nomeCategoria, ORIGENS, nomeProcesso, quem, relativo, type LogLinha } from "@/lib/activityLog";
import { TomAcao } from "./TomAcao";

export function LogDetailSheet({ log, onClose, onFiltrarRegistro, onFiltrarPessoa }: {
  log: LogLinha | null;
  onClose: () => void;
  onFiltrarRegistro: (l: LogLinha) => void;
  onFiltrarPessoa: (l: LogLinha) => void;
}) {
  const q = log ? quem(log) : null;
  const linhas = log ? comparacao(log) : [];
  const temAntes = linhas.some((l) => l.antes !== null);
  const temDepois = linhas.some((l) => l.depois !== null);
  const removidos = log && log.dados_antes && typeof log.dados_antes === "object" && "removidos" in (log.dados_antes as object)
    ? (log.dados_antes as { removidos: number; linhas_guardadas?: number }) : null;

  return (
    <Sheet open={!!log} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {log && q && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <TomAcao acao={log.acao} erro={log.resultado === "erro"} />
                {log.resultado === "erro" && <Badge variant="secondary" className="bg-bad-bg text-bad hover:bg-bad-bg">falhou</Badge>}
              </SheetTitle>
              <SheetDescription>{[rotuloRegistro(log), log.tela].filter(Boolean).join(" · ") || descreverAcao(log.acao).texto}</SheetDescription>
            </SheetHeader>

            <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-2xl border bg-bg-alt/50 p-4 text-sm">
              <dt className="text-muted-foreground">Quem</dt>
              <dd>
                <span className="font-medium">{q.nome}</span>
                {q.detalhe && <span className="text-muted-foreground"> · {q.detalhe}</span>}
                {log.actor_removido && <Badge variant="outline" className="ml-2 text-[11px] text-muted-foreground">acesso removido</Badge>}
                {log.actor_email && log.actor_email !== q.nome && <span className="block text-xs text-muted-foreground">{log.actor_email}</span>}
              </dd>
              <dt className="text-muted-foreground">Quando</dt>
              <dd>{formatarQuando(log.ocorrido_em)} <span className="text-muted-foreground">({relativo(log.ocorrido_em, Date.now())})</span></dd>
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{ORIGENS[log.actor_origem] ?? log.actor_origem}{log.actor_processo && log.actor_id ? ` · ${nomeProcesso(log.actor_processo)}` : ""}</dd>
              <dt className="text-muted-foreground">Categoria</dt>
              <dd>{nomeCategoria(log.categoria)}</dd>
              {log.event_nome && (<><dt className="text-muted-foreground">Evento</dt><dd>{log.event_nome}</dd></>)}
              {!!log.ip && (<><dt className="text-muted-foreground">IP</dt><dd className="font-mono text-xs">{String(log.ip)}</dd></>)}
              {log.user_agent && (<><dt className="text-muted-foreground">Navegador</dt><dd className="break-words text-xs text-muted-foreground">{log.user_agent}</dd></>)}
            </dl>

            {log.detalhe_erro && (
              <div className="mt-4 rounded-2xl border border-bad/30 bg-bad-bg p-3 text-sm text-bad">{log.detalhe_erro}</div>
            )}

            {removidos && (
              <p className="mt-4 text-sm text-muted-foreground">
                {removidos.removidos} {removidos.removidos === 1 ? "linha removida" : "linhas removidas"}. O conteúdo de {removidos.linhas_guardadas ?? 0} delas ficou guardado no registro.
              </p>
            )}

            {!removidos && linhas.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold">{temAntes && temDepois ? "O que mudou" : temDepois ? "Como ficou" : "O que existia"}</h3>
                <div className="overflow-hidden rounded-2xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-alt/60 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Campo</th>
                        {temAntes && <th className="px-3 py-2 font-medium">Antes</th>}
                        {temDepois && <th className="px-3 py-2 font-medium">Depois</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => (
                        <tr key={l.campo} className="border-t align-top">
                          <td className="px-3 py-2 font-medium">{l.rotulo}</td>
                          {temAntes && <td className="break-words px-3 py-2 text-muted-foreground">{l.oculto ? "valor oculto" : l.antes}</td>}
                          {temDepois && <td className="break-words px-3 py-2">{l.oculto ? "valor oculto (alterado)" : l.depois}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onFiltrarRegistro(log)}>
                <History className="h-4 w-4" /> Ver a vida deste registro
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onFiltrarPessoa(log)}>
                <User className="h-4 w-4" /> {q.automacao ? "Ver tudo desta automação" : "Ver tudo desta pessoa"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
