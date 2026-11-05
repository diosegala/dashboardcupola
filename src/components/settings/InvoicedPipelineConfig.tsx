import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { traduzirErro } from "@/lib/mensagensErro";
import type { EventRow } from "@/hooks/useEvent";

// Comercial · ingressos faturados: funil do Pipedrive em que o comercial registra ingressos vendidos fora da Sympla.
// Usa a mesma conta do Pipedrive do evento; os negócios ganhos com produto Ingressos Summit somam nas vendas.
export function InvoicedPipelineConfig({ event, open, onClose }: { event: EventRow | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const eventId = event?.id ?? "";
  const dados = useQuery({
    queryKey: ["invoiced_pipeline", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data: cfg } = await supabase.from("sponsorship_config").select("crm_account, pipelines").eq("event_id", eventId).maybeSingle();
      const account = cfg?.crm_account?.trim();
      if (!account) return { account: null, pipelines: [] as any[], funis: [] as { pd_id: number; name: string }[] };
      const { data: funis } = await supabase.from("crm_pipelines").select("pd_id, name").eq("crm_account", account).eq("is_deleted", false).order("order_nr");
      return { account, pipelines: (cfg?.pipelines as any[]) ?? [], funis: funis ?? [] };
    },
  });
  const [marcados, setMarcados] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setMarcados((dados.data?.pipelines ?? []).filter((p) => p.represents === "ingressos").map((p) => Number(p.pipeline_pd_id)));
  }, [dados.data]);

  async function salvar() {
    setSalvando(true);
    const cotas = (dados.data?.pipelines ?? []).filter((p) => p.represents !== "ingressos");
    const pipelines = [...cotas, ...marcados.map((id) => ({ pipeline_pd_id: id, represents: "ingressos" }))];
    const { error } = await supabase.from("sponsorship_config").update({ pipelines } as any).eq("event_id", eventId);
    setSalvando(false);
    if (error) return toast.error(traduzirErro(error));
    toast.success("Funil salvo. Os faturados entram na próxima sincronização do Pipedrive.");
    qc.invalidateQueries({ queryKey: ["invoiced_pipeline"] });
    qc.invalidateQueries({ queryKey: ["sponsorship_config"] });
    qc.invalidateQueries({ queryKey: ["ticket_sales_all_time"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-[24px]">
        <DialogHeader>
          <DialogTitle>Comercial · ingressos faturados</DialogTitle>
          <DialogDescription>
            Funil do Pipedrive com os ingressos vendidos fora da Sympla. Só os negócios ganhos com produto Ingressos Summit entram nas vendas, nos lotes e nos cupons.
          </DialogDescription>
        </DialogHeader>
        {dados.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !dados.data?.account ? (
          <p className="text-sm text-muted-foreground">Este evento ainda não tem conta do Pipedrive. Ligue a conta em Patrocínio e volte aqui.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {dados.data.funis
              .filter((f) => !(dados.data?.pipelines ?? []).some((p) => p.represents !== "ingressos" && Number(p.pipeline_pd_id) === f.pd_id))
              .map((f) => (
                <label key={f.pd_id} className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm">
                  <Checkbox
                    checked={marcados.includes(f.pd_id)}
                    aria-label={`Ler ingressos faturados do funil ${f.name}`}
                    onCheckedChange={(v) => setMarcados((m) => (v ? [...m, f.pd_id] : m.filter((id) => id !== f.pd_id)))}
                  />
                  <span className="font-medium">{f.name}</span>
                </label>
              ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!dados.data?.account || salvando} onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
