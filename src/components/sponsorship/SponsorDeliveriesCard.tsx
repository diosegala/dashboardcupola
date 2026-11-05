import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import type { Deliverable } from "@/lib/sponsorship";
import type { DeliveryRow, FieldStatus } from "@/lib/sponsorshipExtra";
import { deliveryDue } from "@/lib/sponsorshipExtra";
import { cn } from "@/lib/utils";
import { BarList, CrmWarning, DetailsToggle, int } from "./parts";

export const DELIVERIES_INFO = {
  card: "Status vem do campo \"Entregas concluídas\" do negócio. O item Cupom se marca sozinho quando o cupom do patrocinador aparece na Sympla.",
  prazo: "Data limite da entrega: dias antes da abertura do evento, na lista de entregas da configuração.",
};

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

interface Props {
  rows: DeliveryRow[];
  deliverables: Deliverable[];
  abertura: string;
  hoje: string;
  campos: (FieldStatus | undefined)[];
  className?: string;
}

export function SponsorDeliveriesCard({ rows, deliverables, abertura, hoje, campos, className }: Props) {
  const [aberto, setAberto] = useState(false);
  const itens = deliverables.map((e) => {
    const feitas = rows.filter((r) => r.feitas[e.key]).length;
    const prazo = deliveryDue(abertura, e.days_before_event);
    const atrasada = !!prazo && prazo < hoje && feitas < rows.length;
    return { e, feitas, prazo, atrasada };
  });

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Entregas <InfoTip title="Entregas" text={DELIVERIES_INFO.card} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{int(rows.length)} patrocinadores · {int(deliverables.length)} entregas por patrocinador</p>
        </div>
        {rows.length > 0 && <DetailsToggle open={aberto} onToggle={() => setAberto((v) => !v)} count={rows.length} />}
      </CardHeader>
      <CardContent className="space-y-4">
        {deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">O evento ainda não tem lista de entregas. Cadastre em Configurações › Eventos › Patrocínio.</p>
        ) : (
          <div className="grid gap-x-8 sm:grid-cols-2">
            <BarList
              items={itens.slice(0, Math.ceil(itens.length / 2)).map(({ e, feitas, prazo, atrasada }) => ({
                key: e.key,
                label: e.name,
                value: feitas,
                text: `${int(feitas)} de ${int(rows.length)}`,
                sub: prazo ? `${atrasada ? "Atrasada · " : ""}prazo ${ddmm(prazo)}` : undefined,
                tone: atrasada ? ("warn" as const) : undefined,
              }))}
            />
            <BarList
              items={itens.slice(Math.ceil(itens.length / 2)).map(({ e, feitas, prazo, atrasada }) => ({
                key: e.key,
                label: e.name,
                value: feitas,
                text: `${int(feitas)} de ${int(rows.length)}`,
                sub: prazo ? `${atrasada ? "Atrasada · " : ""}prazo ${ddmm(prazo)}` : undefined,
                tone: atrasada ? ("warn" as const) : undefined,
              }))}
            />
          </div>
        )}
        {aberto && deliverables.length > 0 && (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-[11px] text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      Patrocinador
                      <InfoTip title="Patrocinador" text="Empresa com cota vendida nesta edição." />
                    </span>
                  </th>
                  {deliverables.map((e) => (
                    <th key={e.key} className="px-1.5 pb-2 text-center font-medium">
                      <span className="inline-flex items-center gap-1">
                        {e.name}
                        <InfoTip title={e.name} text={e.key === "cupom" ? "Marcado quando um cupom da Sympla tem o nome da empresa, ou quando a entrega está marcada no Pipedrive." : DELIVERIES_INFO.prazo} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.empresa} className="border-t">
                    <td className="py-1.5 pr-2 font-medium">{r.empresa}</td>
                    {deliverables.map((e) => (
                      <td key={e.key} className="px-1.5 py-1.5 text-center">
                        {r.feitas[e.key] ? <Check className="mx-auto h-3.5 w-3.5 text-ok" aria-label="Feita" /> : <Minus className={cn("mx-auto h-3.5 w-3.5 text-muted-foreground/50")} aria-label="Pendente" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CrmWarning
          fields={campos.filter((c) => c && c.state !== "ok")}
          notes={["Responsável pelo marketing do patrocinador: o Pipedrive não marca a pessoa de marketing do negócio. Criar um campo de pessoa no negócio para isso."]}
        />
      </CardContent>
    </Card>
  );
}
