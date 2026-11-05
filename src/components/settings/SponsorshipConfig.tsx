import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2, RefreshCw, Wand2, Copy } from "lucide-react";
import { toast } from "sonner";
import { traduzirErro } from "@/lib/mensagensErro";
import { useEvent, type EventRow } from "@/hooks/useEvent";
import { useAllSponsorshipConfigs, useReadCrmAccount, useSaveSponsorshipConfig, useSponsorshipConfig } from "@/hooks/useSponsorship";
import {
  DEFAULT_DELIVERABLES,
  EMPTY_DRAFT,
  SP_INFO,
  draftFromTemplate,
  isEventProduct,
  quotaOfProduct,
  quotasFromProducts,
  slug,
  type CrmOptions,
  type SponsorshipDraft,
} from "@/lib/sponsorship";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";

// Rótulo com o "i" ao lado.
function Lbl({ text, info, htmlFor }: { text: string; info: string; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      {text}
      <InfoTip title={text} text={info} />
    </Label>
  );
}

// Cabeçalho de coluna com o "i".
function Th({ text, info, className }: { text: string; info: string; className?: string }) {
  return (
    <TableHead className={className}>
      <span className="inline-flex items-center gap-1.5">
        {text}
        <InfoTip title={text} text={info} />
      </span>
    </TableHead>
  );
}

function Block({ title, info, children, actions }: { title: string; info: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line-strong p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {title}
          <InfoTip title={title} text={info} />
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

interface Props {
  event: EventRow | null;
  open: boolean;
  onClose: () => void;
}

// Bloco "Patrocínio" do cadastro do evento: só o mínimo para os números aparecerem
// (conta, funil, termo e código dos produtos, cotas com preço e lista de entregas).
export function SponsorshipConfig({ event, open, onClose }: Props) {
  const { events } = useEvent();
  const config = useSponsorshipConfig(open ? event?.id : null);
  const allConfigs = useAllSponsorshipConfigs(open);
  const save = useSaveSponsorshipConfig();
  const read = useReadCrmAccount();

  const [draft, setDraft] = useState<SponsorshipDraft>({ ...EMPTY_DRAFT });
  const [options, setOptions] = useState<CrmOptions | null>(null);
  const [copyFrom, setCopyFrom] = useState<string>("");

  // Cada vez que o diálogo abre (ou a configuração chega), parte do que está salvo.
  useEffect(() => {
    if (open && config.data) setDraft(config.data);
  }, [open, config.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) {
      setOptions(null);
      setCopyFrom("");
    }
  }, [open]);

  const set = (patch: Partial<SponsorshipDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const eventId = event?.id ?? null;

  const pipelines = useMemo(() => (options?.pipelines ?? []).filter((p) => !p.is_deleted).sort((a, b) => (a.order_nr ?? 0) - (b.order_nr ?? 0)), [options]);
  // Produtos que contam para o evento: termo no nome e o código configurado.
  const eventProducts = useMemo(
    () => (options?.products ?? []).filter((p) => !p.is_deleted && isEventProduct(p, draft.product_term, draft.product_code)),
    [options, draft.product_term, draft.product_code],
  );

  async function onSave() {
    if (!eventId) return;
    try {
      await save.mutateAsync({ eventId, draft });
      toast.success("Configuração de patrocínio salva");
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + traduzirErro(err));
    }
  }

  async function onRead() {
    if (!eventId) return;
    if (!draft.crm_account.trim()) {
      toast.error("Informe o domínio da conta do Pipedrive");
      return;
    }
    try {
      // A função do servidor lê a conta a partir do que está salvo, então salva antes.
      await save.mutateAsync({ eventId, draft });
      const result = await read.mutateAsync({ eventId, productTerm: draft.product_term });
      setOptions(result);
      toast.success(`Conta lida: ${result.pipelines.length} funis e ${result.products.length} produtos`);
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível ler a conta do Pipedrive");
    }
  }

  function onCopy() {
    const source = allConfigs.data?.get(copyFrom);
    if (!source) {
      toast.error("Esse evento ainda não tem configuração para copiar");
      return;
    }
    setDraft((d) => draftFromTemplate(source, copyFrom, d));
    toast.success("Configuração copiada. Confira os funis marcados como sugestão e salve.");
  }

  function toggleLink(id: number, on: boolean) {
    set({ pipelines: on ? [...draft.pipelines, { pipeline_pd_id: id, represents: "varias_cotas" }] : draft.pipelines.filter((p) => p.pipeline_pd_id !== id) });
  }

  const otherEvents = events.filter((e) => e.id && e.id !== eventId);
  const hasOptions = !!options;
  const pipelineRows = hasOptions
    ? pipelines.map((p) => ({ id: p.id, name: p.name }))
    : draft.pipelines.map((p) => ({ id: p.pipeline_pd_id, name: `Funil ${p.pipeline_pd_id}` }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Patrocínio · {event?.name}
            <InfoTip title="Patrocínio do evento" text={SP_INFO.geral} />
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <Block title="Conta e produtos" info={SP_INFO.conta}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Lbl htmlFor="sp-conta" text="Domínio da conta" info={SP_INFO.conta} />
                <Input id="sp-conta" value={draft.crm_account} placeholder="ex.: empresa" onChange={(e) => set({ crm_account: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Lbl htmlFor="sp-termo" text="Termo do produto" info={SP_INFO.termo} />
                <Input id="sp-termo" value={draft.product_term} placeholder="ex.: nome do evento" onChange={(e) => set({ product_term: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Lbl htmlFor="sp-codigo" text="Código do produto" info={SP_INFO.codigo} />
                <Input id="sp-codigo" value={draft.product_code} placeholder="ex.: código" onChange={(e) => set({ product_code: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={onRead} disabled={read.isPending || save.isPending}>
                <RefreshCw className={`h-4 w-4 ${read.isPending ? "animate-spin" : ""}`} />
                Ler a conta do Pipedrive
              </Button>
              {hasOptions ? <Chip variant="ok">Conta lida</Chip> : <Chip variant="neutral">Conta ainda não lida</Chip>}
              <span className="text-xs text-muted-foreground">O token fica na tela Integrações e nunca chega ao navegador.</span>
            </div>
            {hasOptions && (
              <p className="text-xs text-muted-foreground">
                {eventProducts.length === 0
                  ? "Nenhum produto da conta tem o termo no nome e o código informado."
                  : `${eventProducts.length} produtos contam para o evento: ${eventProducts.map((p) => p.name).join(", ")}.`}
              </p>
            )}
          </Block>

          <Block title="Funil do evento" info={SP_INFO.funis}>
            {pipelineRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Leia a conta do Pipedrive para listar os funis.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {pipelineRows.map((p) => {
                  const link = draft.pipelines.find((l) => l.pipeline_pd_id === p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
                      <Checkbox checked={!!link} aria-label={`Usar o funil ${p.name}`} onCheckedChange={(v) => toggleLink(p.id, !!v)} />
                      <span className="font-medium">{p.name}</span>
                      {link?.suggested && <Chip variant="warn" className="ml-auto">Sugestão</Chip>}
                    </label>
                  );
                })}
              </div>
            )}
          </Block>

          <Block
            title="Cotas"
            info={SP_INFO.cotas}
            actions={
              <div className="flex gap-2">
                {hasOptions && (
                  <Button type="button" size="sm" variant="outline" onClick={() => set({ quotas: quotasFromProducts(eventProducts, draft.quotas) })}>
                    <Wand2 className="h-4 w-4" />
                    Criar a partir dos produtos
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => set({ quotas: [...draft.quotas, { key: `cota_${draft.quotas.length + 1}`, name: "", order: draft.quotas.length + 1, list_price: null, max_slots: null }] })}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar cota
                </Button>
              </div>
            }
          >
            {draft.quotas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cota. Adicione à mão ou crie a partir dos produtos do evento.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <Th text="Ordem" info="Posição da cota na página." className="w-20" />
                    <Th text="Nome" info={SP_INFO.cotaNome} />
                    <Th text="Preço de tabela (R$)" info={SP_INFO.cotaPreco} />
                    <Th text="Vagas" info={SP_INFO.cotaVagas} />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...draft.quotas]
                    .sort((a, b) => a.order - b.order)
                    .map((q) => {
                      const patch = (p: Partial<typeof q>) => set({ quotas: draft.quotas.map((x) => (x.key === q.key ? { ...x, ...p } : x)) });
                      const produtos = eventProducts.filter((p) => quotaOfProduct(p.name, draft.quotas)?.key === q.key);
                      return (
                        <TableRow key={q.key}>
                          <TableCell>
                            <Input type="number" min={1} aria-label="Ordem da cota" value={q.order} onChange={(e) => patch({ order: Number(e.target.value) || 1 })} />
                          </TableCell>
                          <TableCell>
                            <Input aria-label="Nome da cota" value={q.name} onChange={(e) => patch({ name: e.target.value, key: q.key.startsWith("cota_") ? slug(e.target.value) || q.key : q.key })} />
                            {hasOptions && (
                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                {produtos.length ? produtos.map((p) => p.name).join(", ") : "Nenhum produto com este nome"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} aria-label="Preço de tabela" value={q.list_price ?? ""} onChange={(e) => patch({ list_price: numOrNull(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} aria-label="Vagas" value={q.max_slots ?? ""} onChange={(e) => patch({ max_slots: numOrNull(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" title="Remover cota" onClick={() => set({ quotas: draft.quotas.filter((x) => x.key !== q.key) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </Block>

          <Block
            title="Entregas"
            info={SP_INFO.entregas}
            actions={
              <div className="flex gap-2">
                {draft.deliverables.length === 0 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => set({ deliverables: DEFAULT_DELIVERABLES })}>
                    <Wand2 className="h-4 w-4" />
                    Usar lista inicial
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => set({ deliverables: [...draft.deliverables, { key: `entrega_${draft.deliverables.length + 1}`, name: "", days_before_event: null }] })}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar entrega
                </Button>
              </div>
            }
          >
            {draft.deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma entrega. Use a lista inicial ou copie de outro evento.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <Th text="Entrega" info="Contrapartida prometida ao patrocinador." />
                    <Th text="Prazo (dias antes do evento)" info={SP_INFO.entregaPrazo} />
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.deliverables.map((d, i) => {
                    const patch = (p: Partial<typeof d>) => set({ deliverables: draft.deliverables.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                    return (
                      <TableRow key={d.key + i}>
                        <TableCell>
                          <Input aria-label="Nome da entrega" value={d.name} onChange={(e) => patch({ name: e.target.value, key: d.key.startsWith("entrega_") ? slug(e.target.value) || d.key : d.key })} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} aria-label="Prazo em dias" value={d.days_before_event ?? ""} onChange={(e) => patch({ days_before_event: numOrNull(e.target.value) })} />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" title="Remover entrega" onClick={() => set({ deliverables: draft.deliverables.filter((_, j) => j !== i) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Block>

          <Block title="Copiar de outro evento" info={SP_INFO.copiar}>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={copyFrom || undefined} onValueChange={setCopyFrom}>
                <SelectTrigger className="w-[260px]" aria-label="Evento modelo">
                  <SelectValue placeholder="Escolha o evento modelo" />
                </SelectTrigger>
                <SelectContent>
                  {otherEvents.map((e) => (
                    <SelectItem key={e.id as string} value={e.id as string}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!copyFrom} onClick={onCopy}>
                <Copy className="h-4 w-4" />
                Copiar configuração
              </Button>
            </div>
          </Block>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave} disabled={save.isPending || !eventId}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
