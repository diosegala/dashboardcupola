import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, type ChipVariant } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";

// Fontes acompanhadas no painel, na ordem de exibição.
const FONTES = [
  { key: "sympla", label: "Sympla" },
  { key: "meta", label: "Meta Ads" },
  { key: "google_ads", label: "Google Ads" },
  { key: "google_analytics", label: "Google Analytics" },
  { key: "rd_station", label: "RD Station" },
];

// Sem sincronizar há mais de 26 horas conta como atrasada.
const LIMITE_ATRASO_MS = 26 * 60 * 60 * 1000;

// Retorno de get_integrations_status: status já vem como "inactive" quando a integração está desligada.
interface StatusIntegracao {
  name: string;
  status: string;
  last_synced_at: string | null;
}

function situacao(i: StatusIntegracao | undefined): { label: string; variant: ChipVariant } {
  if (!i) return { label: "Não configurada", variant: "neutral" };
  if (i.status === "inactive") return { label: "Inativa", variant: "neutral" };
  if (i.status === "error") return { label: "Erro", variant: "bad" };
  if (i.status === "syncing") return { label: "Sincronizando", variant: "warn" };
  if (!i.last_synced_at || Date.now() - new Date(i.last_synced_at).getTime() > LIMITE_ATRASO_MS) {
    return { label: "Atrasada", variant: "warn" };
  }
  return { label: "Em dia", variant: "ok" };
}

export function IntegrationsHealthCard() {
  // Função do banco liberada só para administradores; devolve status sem credenciais.
  const { data, isLoading } = useQuery({
    queryKey: ["integrations_health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_integrations_status");
      if (error) throw error;
      return data as StatusIntegracao[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Saúde das integrações
          <InfoTip title="Saúde das integrações" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FONTES.map((f) => (
              <Skeleton key={f.key} className="h-[72px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FONTES.map((f) => {
              const i = data?.find((d) => d.name === f.key);
              const s = situacao(i);
              return (
                <div key={f.key} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm font-semibold">{f.label}</b>
                    <Chip variant={s.variant}>{s.label}</Chip>
                  </div>
                  <small className="text-xs text-muted-foreground">
                    {i?.last_synced_at
                      ? `Atualizada ${formatDistanceToNow(new Date(i.last_synced_at), { addSuffix: true, locale: ptBR })}`
                      : "Sem sincronização registrada"}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
