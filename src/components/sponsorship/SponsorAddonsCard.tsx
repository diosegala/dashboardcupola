import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import type { AddonItem } from "@/lib/sponsorshipExtra";
import { CardTabs } from "./CardTabs";
import { BarList, CrmWarning, brlShort, int } from "./parts";

export const ADDONS_INFO = {
  card: "Cada item é uma variação do produto de adicionais do evento no Pipedrive. A quantidade conta unidades (ex.: 3 credenciais).",
  vendidos: "Itens adicionais em negócios ganhos nesta edição: quantidade, valor e em quantas vendas.",
  negociacao: "Itens adicionais em negócios abertos: o interesse que ainda não fechou.",
};

const SEM_ITEM = "Sem item no Pipedrive";

export function SponsorAddonsCard({ vendidos, negociacao, semVariacao, className }: { vendidos: AddonItem[]; negociacao: AddonItem[]; semVariacao: boolean; className?: string }) {
  const [aba, setAba] = useState<"vendidos" | "negociacao">("vendidos");
  const lista = aba === "vendidos" ? vendidos : negociacao;
  const total = vendidos.reduce((t, a) => t + a.valor, 0);
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Adicionais <InfoTip title="Adicionais" text={ADDONS_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {brlShort(total)} em {int(vendidos.reduce((t, a) => t + a.vendas, 0))} vendas
          </p>
        </div>
        <CardTabs
          value={aba}
          onChange={(v) => setAba(v as typeof aba)}
          tabs={[
            { value: "vendidos", label: "Vendidos", info: ADDONS_INFO.vendidos },
            { value: "negociacao", label: "Em negociação", info: ADDONS_INFO.negociacao },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <BarList
          color="bg-chart-4"
          items={lista.map((a) => ({
            key: a.item || "__sem",
            label: a.item || SEM_ITEM,
            value: a.quantidade,
            text: `${int(a.quantidade)} ${a.quantidade === 1 ? "unidade" : "unidades"}`,
            sub: `${brlShort(a.valor)}${a.vendas ? ` · ${int(a.vendas)} ${a.vendas === 1 ? "venda" : "vendas"}` : ""}`,
            tone: a.item ? undefined : ("muted" as const),
          }))}
          empty={aba === "vendidos" ? "Nenhum adicional vendido nesta edição." : "Nenhum adicional em negociação."}
        />
        <CrmWarning
          notes={[
            semVariacao &&
              `Itens adicionais: há adicionais sem variação no Pipedrive (aparecem como "${SEM_ITEM}"). Criar uma variação para cada item no produto de adicionais e usar a variação no negócio.`,
          ]}
        />
      </CardContent>
    </Card>
  );
}
