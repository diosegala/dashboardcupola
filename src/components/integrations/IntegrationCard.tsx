import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ticket, PieChart, Megaphone, BarChart3, Mail, Globe, RefreshCw, Settings, AlertTriangle, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Integration } from "@/hooks/useIntegrations";
import { CredentialsForm } from "./CredentialsForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [syncingPrevious, setSyncingPrevious] = useState(false);
  const Icon = ICONS[integration.name] ?? Globe;
  const label = LABELS[integration.name] ?? integration.name;
  const isSyncing = integration.sync_status === "syncing";
  const isError = integration.sync_status === "error";
  const creds = (integration.credentials as Record<string, string>) ?? {};
  const hasPreviousEvent = integration.name === "sympla" && !!creds.previous_event_id;

  const handleSyncPrevious = async () => {
    setSyncingPrevious(true);
    try {
      const { error } = await supabase.functions.invoke("sync-sympla", {
        body: { event_id: creds.previous_event_id },
      });
      if (error) throw error;
      toast.success("Sincronização do evento anterior iniciada!");
    } catch (err: any) {
      toast.error("Erro ao sincronizar evento anterior: " + err.message);
    } finally {
      setSyncingPrevious(false);
    }
  };

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
              className={isSyncing ? "animate-pulse bg-yellow-500 text-yellow-950" : ""}
            >
              {isSyncing ? "Sincronizando..." : isError ? "Erro" : integration.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {integration.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Última sync: {formatDistanceToNow(new Date(integration.last_synced_at), { addSuffix: true, locale: ptBR })}
            </p>
          )}

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
              onClick={() => onSync(integration.name)}
              disabled={!isAdmin || !integration.is_active || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
            {hasPreviousEvent && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncPrevious}
                disabled={!isAdmin || !integration.is_active || syncingPrevious}
              >
                <History className={`h-4 w-4 mr-1 ${syncingPrevious ? "animate-spin" : ""}`} />
                Sync Anterior
              </Button>
            )}
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
