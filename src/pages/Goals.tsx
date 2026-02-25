import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function Goals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Metas</h1>
        <p className="text-muted-foreground">Gerencie as metas de vendas e marketing</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma meta configurada ainda. A funcionalidade será implementada na Fase 3.</p>
        </CardContent>
      </Card>
    </div>
  );
}
