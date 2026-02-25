import { useIntegrations } from "@/hooks/useIntegrations";
import { useAuth } from "@/hooks/useAuth";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Integrations() {
  const { integrations, isLoading, updateIntegration, syncIntegration } = useIntegrations();
  const { isAdmin } = useAuth();

  const handleToggle = (id: string, active: boolean) => {
    updateIntegration.mutate({ id, updates: { is_active: active } });
  };

  const handleSync = (name: string) => {
    syncIntegration.mutate(name);
  };

  const handleSaveCredentials = (id: string, credentials: Record<string, string>) => {
    updateIntegration.mutate(
      { id, updates: { credentials } },
      { onSuccess: () => toast.success("Credenciais salvas!") }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Configure as integrações com Sympla, Pipedrive, Meta Ads e mais
        </p>
        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-1">
            Você tem acesso de visualização. Apenas administradores podem editar configurações.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              isAdmin={isAdmin}
              onToggle={handleToggle}
              onSync={handleSync}
              onSaveCredentials={handleSaveCredentials}
            />
          ))}
        </div>
      )}
    </div>
  );
}
