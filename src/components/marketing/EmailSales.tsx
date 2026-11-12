import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent } from "@/hooks/useEvent";
import { useBuyersData } from "@/hooks/useBuyersData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { canalDe } from "@/lib/salesChannel";
import { formatPhone, normName, type Person } from "@/lib/buyers";
import { groupByPurchase, linkSales, summarizeEmailSales, type Decision, type EmailSale, type EmailSalesBucket, type LinkWarning } from "@/lib/emailAttribution";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";

export const EMAIL_SALES_INFO =
  "O selo mostra quantos ingressos pagos cada e-mail vendeu, contando só as compras feitas pelo link do e-mail. Use para repetir nos próximos lotes os e-mails que venderam. Só recebem selo os e-mails cujo link de compra permitiu identificar a origem da venda. Selo tracejado = ligação estimada pelo nome do e-mail.";

// Decisões do administrador sobre ligações (confirmar, trocar ou deixar sem ligação).
export function useEmailDecisions() {
  return useQuery({
    queryKey: ["email_sale_links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_sale_links").select("utm_content, rd_campaign_id");
      if (error) throw error;
      return (data ?? []) as Decision[];
    },
  });
}

function useDecide() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ utm, emailId }: { utm: string; emailId: string | null }) => {
      const { error } = await supabase
        .from("email_sale_links")
        .upsert({ utm_content: utm, rd_campaign_id: emailId, decision: emailId ? "confirmed" : "sem_ligacao", decided_by: user?.id ?? null, decided_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_sale_links"] });
      toast.success("Ligação guardada");
    },
    onError: () => toast.error("Não foi possível guardar a ligação"),
  });
}

export interface EmailSaleRow extends EmailSale {
  ticket: Ticket;
}

// Vendas do canal E-mail marketing (mesma regra da meta por canal: pagantes, sem cancelados) ligadas aos e-mails.
export function useEmailAttribution(emails: any[], tickets: Ticket[]) {
  const decisions = useEmailDecisions();
  return useMemo(() => {
    const vendas: EmailSaleRow[] = splitTickets(tickets)
      .paying.filter((t) => canalDe(t) === "E-mail marketing")
      .map((t, i) => ({
        id: String(t.sympla_order_id ?? t.deal_id ?? i),
        utmContent: t.utm_content ?? null,
        soldAt: t.sold_at,
        quantidade: t.quantity || 0,
        valor: Number(t.total_price || 0),
        ticket: t,
      }));
    const refs = emails.map((e) => ({ id: String(e.rd_campaign_id), name: String(e.name || e.subject || ""), sentAt: e.sent_at ?? null }));
    const links = linkSales(vendas, refs, decisions.data ?? []);
    const resumo = summarizeEmailSales(vendas, links);
    const total = vendas.reduce((t, v) => t + v.quantidade, 0);
    return { ...resumo, vendas: vendas as EmailSaleRow[], links, total };
  }, [emails, tickets, decisions.data]);
}

export function EmailSalesBadge({ bucket, onClick }: { bucket: EmailSalesBucket; onClick: () => void }) {
  const estimada = bucket.level === "provavel";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
            estimada ? "border border-dashed border-ok/60 text-ok hover:bg-ok-bg/50" : "bg-ok-bg text-ok hover:brightness-95",
          )}
        >
          {int(bucket.ingressos)} {bucket.ingressos === 1 ? "venda" : "vendas"}
          {estimada && <span className="font-normal opacity-80">· ligação estimada</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Receita: {brl(bucket.receita)}
        {estimada ? " · ligação estimada pelo nome do e-mail" : ""}
      </TooltipContent>
    </Tooltip>
  );
}

// Lista das vendas de um e-mail: ingresso comprado e comprador (dados de pessoas só para quem vê a tela Compradores).
export function EmailSalesSheet({
  bucket,
  emailName,
  emails,
  vendas,
  onClose,
}: {
  bucket: EmailSalesBucket | null;
  emailName: string;
  emails: { id: string; nome: string }[];
  vendas: EmailSaleRow[];
  onClose: () => void;
}) {
  const { isAdmin, canViewAll } = useAuth();
  const { event } = useEvent();
  const { people } = useBuyersData();
  const decide = useDecide();
  const [pessoa, setPessoa] = useState<Person | null>(null);
  const [troca, setTroca] = useState<string>("");
  const ids = new Set(bucket?.vendas.map((v) => v.id));
  const compras = groupByPurchase(
    vendas.filter((v) => ids.has(v.id)),
    (v) => String(v.ticket.order_id ?? v.ticket.sympla_order_id ?? v.id),
  );
  const tiposDe = (vs: EmailSaleRow[]) => {
    const m = new Map<string, number>();
    vs.forEach((v) => m.set(v.ticket.ticket_type ?? "Ingresso", (m.get(v.ticket.ticket_type ?? "Ingresso") ?? 0) + v.quantidade));
    return [...m.entries()].map(([t, n]) => (n > 1 ? `${int(n)}× ${t}` : t)).join(" · ");
  };

  const acharPessoa = (t: Ticket): Person | null => {
    const pedidos = [t.order_id, t.sympla_order_id].filter(Boolean).map(String);
    const porPedido = people.find((p) => Object.values(p.events).some((e) => pedidos.some((o) => e.orders.has(o))));
    if (porPedido) return porPedido;
    const n = normName(t.buyer_name);
    return n ? people.find((p) => normName(p.name) === n && p.events[event.slug]) ?? null : null;
  };

  return (
    <>
      <Sheet open={!!bucket} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="pr-6 text-base leading-snug">{emailName}</SheetTitle>
            <SheetDescription>
              {bucket && `${int(compras.length)} ${compras.length === 1 ? "compra" : "compras"} · ${int(bucket.ingressos)} ${bucket.ingressos === 1 ? "ingresso" : "ingressos"} · ${brl(bucket.receita)}`}
              {bucket?.level === "provavel" && <span className="block text-[11px]">Ligação estimada pelo nome do e-mail.</span>}
            </SheetDescription>
          </SheetHeader>

          {isAdmin && bucket?.level === "provavel" && (
            <div className="mt-4 space-y-2 rounded-xl border border-dashed p-3 text-xs">
              <p className="text-muted-foreground">Confira se estas vendas vieram mesmo deste e-mail. A decisão fica guardada.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-7 text-xs" disabled={decide.isPending} onClick={() => bucket.utms.forEach((u) => decide.mutate({ utm: u, emailId: bucket.emailId }))}>
                  Confirmar este e-mail
                </Button>
                <Select value={troca} onValueChange={(v) => { setTroca(v); bucket.utms.forEach((u) => decide.mutate({ utm: u, emailId: v === "__nenhum" ? null : v })); onClose(); }}>
                  <SelectTrigger className="h-7 w-auto min-w-[150px] text-xs"><SelectValue placeholder="Trocar e-mail" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhum">Nenhum e-mail (sem ligação)</SelectItem>
                    {emails.filter((e) => e.id !== bucket.emailId).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <ul className="mt-4 divide-y">
            {compras.map((c) => {
              const v = c.vendas[0];
              const p = canViewAll ? acharPessoa(v.ticket) : null;
              return (
                <li key={c.pedido} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    {canViewAll ? (
                      <button type="button" className="text-left font-medium hover:underline disabled:no-underline" disabled={!p} onClick={() => p && setPessoa(p)}>
                        {p?.name ?? v.ticket.buyer_name ?? "Comprador sem nome"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Comprador visível só para administradores</span>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      {tiposDe(c.vendas)} · {dataHora(c.soldAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="font-semibold">{brl(c.valor)}</div>
                    <div className="text-[11px] text-muted-foreground">{int(c.ingressos)} {c.ingressos === 1 ? "ingresso" : "ingressos"}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      {/* Os mesmos dados da tela Compradores › Pessoas, nada a mais. */}
      <Dialog open={!!pessoa} onOpenChange={(o) => !o && setPessoa(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pessoa?.name}</DialogTitle>
            <DialogDescription>Mesmos dados da tela Compradores.</DialogDescription>
          </DialogHeader>
          {pessoa && (
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Empresa</dt><dd>{pessoa.companies[0] ?? "—"}</dd>
              <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{pessoa.emails[0] ?? "—"}</dd>
              <dt className="text-muted-foreground">Telefone</dt><dd className="tabular-nums">{pessoa.phones[0] ? formatPhone(pessoa.phones[0]) : "—"}</dd>
              <dt className="text-muted-foreground">Participou</dt>
              <dd className="flex flex-wrap gap-1">
                {Object.values(pessoa.events).sort((a, b) => a.event.endDate.localeCompare(b.event.endDate)).map((e) => (
                  <span key={e.event.slug} title={e.event.name} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", e.event.slug === event.slug ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80")}>
                    {e.event.label}
                  </span>
                ))}
              </dd>
              <dt className="text-muted-foreground">Cupom</dt>
              <dd className="font-mono text-[11px]">{[...new Set(Object.values(pessoa.events).flatMap((e) => [...e.coupons]))].join(", ") || "—"}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Aviso para todos: como a ligação é feita e como trazer certeza. Mesmo padrão do aviso do CRM.
export function EmailLinkNotice({ semLigacao }: { semLigacao: number }) {
  return (
    <div className="rounded-xl border border-dashed border-warn/50 bg-warn-bg/40 px-3 py-2 text-xs text-foreground/80">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-warn">
        <Search className="h-3.5 w-3.5" />
        Como as vendas são ligadas aos e-mails
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        <li>O RD Station não informa o link de cada e-mail. Por isso, parte das ligações é estimada pelo nome do e-mail e confirmada pelo horário de envio. Essas aparecem como "ligação estimada".</li>
        <li>Para ter certeza: comece o nome do e-mail no RD com um código curto (ex.: sum27-segredo-curadoria) e use o mesmo código no utm_content do link.</li>
        <li>
          Vendas sem identificação no link continuam contando no canal E-mail marketing, mesmo sem selo
          {semLigacao > 0 ? ` (hoje: ${int(semLigacao)} ${semLigacao === 1 ? "ingresso" : "ingressos"} neste recorte).` : "."}
        </li>
      </ul>
    </div>
  );
}

// Avisos de inconsistência, só para administradores.
export function EmailLinkWarnings({ avisos, nomeDe }: { avisos: LinkWarning[]; nomeDe: (id: string) => string }) {
  const { isAdmin } = useAuth();
  const decide = useDecide();
  if (!isAdmin || !avisos.length) return null;
  const qtd = (a: LinkWarning) => `${int(a.ingressos)} ${a.ingressos === 1 ? "ingresso" : "ingressos"} (${brl(a.receita)})`;
  const texto = (a: LinkWarning) => {
    if (a.tipo === "sem_email")
      return `Link "${a.utmContent}": ${qtd(a)} vendidos sem nenhum e-mail correspondente no RD. Verifique com o marketing se o envio foi feito fora do RD. Se não foi por e-mail, a venda pode estar no canal errado da meta por canal.`;
    if (a.tipo === "so_horario")
      return `Link "${a.utmContent}": ${qtd(a)} só têm sugestão pelo horário ("${a.emails.map(nomeDe).join('", "')}"), sem nome compatível. Confirme o e-mail correto pelo selo ou verifique com o marketing se o envio foi feito fora do RD. Se não foi por e-mail, a venda pode estar no canal errado da meta por canal.`;
    return `Link "${a.utmContent}": ${qtd(a)} ligados a mais de um e-mail (${a.emails.map((e) => `"${nomeDe(e)}"`).join(", ")}). Confira pelo selo de cada e-mail se a divisão está certa.`;
  };
  return (
    <div className="rounded-xl border border-dashed border-warn/50 bg-warn-bg/40 px-3 py-2 text-xs text-foreground/80">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-warn">
        <Search className="h-3.5 w-3.5" />
        Para investigar nos e-mails (só administradores)
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        {avisos.map((a) => (
          <li key={`${a.tipo}-${a.utmContent}`}>
            {texto(a)}
            {a.tipo === "so_horario" && a.emails.length === 1 && (
              <button type="button" className="ml-1 font-semibold text-foreground underline-offset-2 hover:underline" disabled={decide.isPending} onClick={() => decide.mutate({ utm: a.utmContent, emailId: a.emails[0] })}>
                Confirmar sugestão
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
