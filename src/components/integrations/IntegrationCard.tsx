import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/Chip";
import { Ticket, PieChart, Megaphone, BarChart3, Mail, Globe, RefreshCw, KeyRound, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Integration } from "@/hooks/useIntegrations";
import { INTEGRATIONS, explicarErro, frequenciaTexto, saudeIntegracao, credenciaisFaltando } from "@/lib/integrationHealth";
import { cn } from "@/lib/utils";
import { CredentialsForm } from "./CredentialsForm";

const ICONS: Record<string, React.ElementType> = {
  sympla: Ticket,
  pipedrive: PieChart,
  meta: Megaphone,
  google_ads: BarChart3,
  rd_station: Mail,
  google_analytics: Globe,
};

interface Props {
  integration: Integration;
  isAdmin: boolean;
  onToggle: (id: string, active: boolean) => void;
  onSync: (name: string) => void;
  onSaveCredentials: (id: string, credentials: Record<string, string>) => void;
}

// Uma linha por fonte: o que traz, situação, última atualização e as ações da conta.
export function IntegrationRow({ integration, isAdmin, onToggle, onSync, onSaveCredentials }: Props) {
  const [showCredentials, setShowCredentials] = useState(false);
  const Icon = ICONS[integration.name] ?? Globe;
  const info = INTEGRATIONS[integration.name];
  const label = info?.label ?? integration.name;
  const saude = saudeIntegracao(integration);
  const sincronizando = saude.estado === "sincronizando";
  const faltando = credenciaisFaltando(integration);

  const aviso =
    saude.estado === "erro"
      ? explicarErro(integration.name, integration.error_message)
      : saude.estado === "sem_credenciais"
        ? `Preencha: ${faltando.join(", ")}.`
        : saude.estado === "interrompida"
          ? "A última atualização parou no meio. O próximo agendamento tenta de novo sozinho."
          : saude.estado === "atrasada"
            ? "Faz tempo que não atualiza. Use o botão de atualizar ou confira as credenciais."
            : saude.estado === "desligada" && integration.error_message
              ? `Desligada até resolver: ${explicarErro(integration.name, integration.error_message)}`
              : null;

  const ultima = integration.last_synced_at
    ? `Atualizada ${formatDistanceToNow(new Date(integration.last_synced_at), { addSuffix: true, locale: ptBR })}`
    : "Nunca atualizou";

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
            integration.is_active ? "bg-primary/25 text-accent-text" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[15px] font-semibold">{label}</b>
            <Chip variant={saude.variant}>{saude.label}</Chip>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{info?.traz}</p>
        </div>

        <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
        <div className="min-w-0 text-sm text-muted-foreground sm:text-right">
          <div className="text-foreground/80">{ultima}</div>
          <div className="text-xs">
            {integration.is_active ? `Automática, ${frequenciaTexto(info?.frequenciaMin ?? 15)}` : "Sem atualização automática"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isAdmin && integration.is_active && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSync(integration.name)}
              disabled={sincronizando}
              title="Atualizar agora"
              aria-label={`Atualizar ${label} agora`}
              className="h-9 w-9 rounded-full"
            >
              <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowCredentials(true)}
            disabled={!isAdmin}
            title="Credenciais"
            aria-label={`Credenciais de ${label}`}
            className="h-9 w-9 rounded-full"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Switch
            checked={integration.is_active}
            onCheckedChange={(checked) => onToggle(integration.id, checked)}
            disabled={!isAdmin}
            aria-label={integration.is_active ? `Desligar ${label}` : `Ligar ${label}`}
            className="ml-1.5"
          />
        </div>
        </div>
      </div>

      {aviso && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm sm:ml-[60px]",
            saude.estado === "erro"
              ? "bg-bad-bg text-bad"
              : saude.estado === "desligada"
                ? "bg-secondary text-foreground/75"
                : "bg-warn-bg text-warn",
          )}
          title={integration.error_message ?? undefined}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <CredentialsForm
        open={showCredentials}
        onOpenChange={setShowCredentials}
        integration={integration}
        onSave={(creds) => onSaveCredentials(integration.id, creds)}
      />
    </li>
  );
}
