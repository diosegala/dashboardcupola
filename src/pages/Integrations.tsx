import { Navigate } from "react-router-dom";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useAuth } from "@/hooks/useAuth";
import { IntegrationRow } from "@/components/integrations/IntegrationCard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ORDEM, saudeIntegracao } from "@/lib/integrationHealth";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Integrations() {
  const { integrations, isLoading, updateIntegration, syncIntegration } = useIntegrations();
  const { isAdmin, loading } = useAuth();

  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleToggle = (id: string, active: boolean) => {
    updateIntegration.mutate({ id, updates: { is_active: active } });
  };

  const handleSync = (name: string) => {
    syncIntegration.mutate(name);
  };

  const handleSaveCredentials = (id: string, credentials: Record<string, string>) => {
    updateIntegration.mutate(
      { id, updates: { credentials } },
      { onSuccess: () => toast.success("Credenciais salvas!") },
    );
  };

  const ordenadas = [...integrations].sort(
    (a, b) => (ORDEM.indexOf(a.name) + 1 || 99) - (ORDEM.indexOf(b.name) + 1 || 99),
  );
  const funcionando = ordenadas.filter((i) => saudeIntegracao(i).funcionando).length;
  const tudoCerto = ordenadas.length > 0 && funcionando === ordenadas.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrações"
        description="As fontes que alimentam o painel. Elas se atualizam sozinhas; aqui você confere a situação e ajusta as contas."
      />

      {isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-14" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            className={cn(
              "flex items-center gap-3 border-b px-5 py-4 sm:px-6",
              tudoCerto ? "bg-ok-bg/60" : "bg-warn-bg/60",
            )}
          >
            {tudoCerto ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
            )}
            <div>
              <b className="font-semibold">
                {funcionando} de {ordenadas.length} funcionando
              </b>
              <p className="text-sm text-muted-foreground">
                {tudoCerto ? "Todos os dados estão chegando normalmente." : "Veja abaixo o que precisa de atenção."}
              </p>
            </div>
          </div>
          <ul className="divide-y">
            {ordenadas.map((integration) => (
              <IntegrationRow
                key={integration.id}
                integration={integration}
                isAdmin={isAdmin}
                onToggle={handleToggle}
                onSync={handleSync}
                onSaveCredentials={handleSaveCredentials}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
