import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ticket, PieChart, Megaphone, BarChart3, Mail, Globe, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Integration } from "@/hooks/useIntegrations";
import { CredentialsForm } from "./CredentialsForm";

const ICONS: Record<string, React.ElementType> = {
  sympla: Ticket,
  pipedrive: PieChart,
  meta: Megaphone,
  google_ads: BarChart3,
  rd_station: Mail,
  google_analytics: Globe,
};

const LABELS: Record<string, string> = {
  sympla: "Sympla",
  pipedrive: "Pipedrive",
  meta: "Meta Ads",
  google_ads: "Google Ads",
  rd_station: "RD Station",
  google_analytics: "Google Analytics",
};

interface Props {
  integration: Integration;
  isAdmin: boolean;
  onToggle: (id: string, active: boolean) => void;
  onSync: (name: string) => void;
  onSaveCredentials: (id: string, credentials: Record<string, string>) => void;
}

export function IntegrationCard({ integration, isAdmin, onToggle, onSync, onSaveCredentials }: Props) {
  const [showCredentials, setShowCredentials] = useState(false);
  const Icon = ICONS[integration.name] ?? Globe;
  const label = LABELS[integration.name] ?? integration.name;
  const isSyncing = integration.sync_status === "syncing";
  const isError = integration.sync_status === "error";


  return (
    <>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="h-5 w-5 text-accent-text" />
              {label}
            </CardTitle>
            <Badge
              variant={isSyncing ? "default" : isError ? "destructive" : integration.is_active ? "default" : "secondary"}
              className={isSyncing ? "animate-pulse bg-warn-bg text-warn" : ""}
            >
              {isSyncing ? "Sincronizando..." : isError ? "Erro" : integration.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Atualiza sozinho pelo agendamento; o ícone força uma atualização na hora (só administradores). */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {integration.is_active ? "Atualiza sozinho" : "Desligada"}
              {integration.last_synced_at && (
                <> · última vez {formatDistanceToNow(new Date(integration.last_synced_at), { addSuffix: true, locale: ptBR })}</>
              )}
            </p>
            {isAdmin && integration.is_active && (
              <button
                type="button"
                onClick={() => onSync(integration.name)}
                disabled={isSyncing}
                title="Atualizar agora"
                aria-label="Atualizar agora"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {isError && integration.error_message && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{integration.error_message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={integration.is_active}
                onCheckedChange={(checked) => onToggle(integration.id, checked)}
                disabled={!isAdmin}
              />
              <span className="text-sm text-muted-foreground">{integration.is_active ? "Ativo" : "Inativo"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCredentials(true)}
              disabled={!isAdmin}
            >
              <Settings className="h-4 w-4 mr-1" />
              Credenciais
            </Button>
          </div>
        </CardContent>
      </Card>

      <CredentialsForm
        open={showCredentials}
        onOpenChange={setShowCredentials}
        integration={integration}
        onSave={(creds) => onSaveCredentials(integration.id, creds)}
      />
    </>
  );
}
