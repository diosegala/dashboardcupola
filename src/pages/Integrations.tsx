import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">Configure as integrações com Sympla, Pipedrive, Meta Ads e mais</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrações disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A configuração de integrações será implementada na Fase 4.</p>
        </CardContent>
      </Card>
    </div>
  );
}
