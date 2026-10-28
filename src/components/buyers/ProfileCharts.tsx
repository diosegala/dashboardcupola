import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { HBars, countBy, regiaoDe } from "@/components/dashboard/CommercialSegments";
import { themeCharts } from "@/lib/formQuestions";
import { isApproved } from "@/lib/eventConfig";
import type { Ticket } from "@/hooks/useCommercialMetrics";

const int = (n: number) => n.toLocaleString("pt-BR");

interface ProfileChartsProps {
  tickets: Ticket[];
  formAnswers: { question: string; answer: string; total: number }[];
}

// Perfil de quem vai ao evento: só totais, sem dados pessoais. Perguntas novas do formulário aparecem sozinhas.
export function ProfileCharts({ tickets, formAnswers }: ProfileChartsProps) {
  const aprovados = useMemo(() => tickets.filter((t) => isApproved(t.status)), [tickets]);
  const porRegiao = useMemo(() => countBy(aprovados, (t) => (t.buyer_state ? regiaoDe(t.buyer_state) : null)), [aprovados]);
  const porPerfil = useMemo(() => countBy(aprovados, (t) => t.company_size).slice(0, 8), [aprovados]);
  const temas = useMemo(() => themeCharts(formAnswers), [formAnswers]);

  const cards = [
    { title: "Região", items: porRegiao, distinct: porRegiao.length },
    { title: "Perfil da empresa", items: porPerfil, distinct: countBy(aprovados, (t) => t.company_size).length },
    ...temas,
  ].filter((c) => c.items.length > 0);

  if (cards.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Ainda não há respostas do formulário para este evento.</p>;
  }

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      {cards.map((c) => (
        <Card key={c.title} className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              {c.title} <InfoTip title={c.title} />
            </CardTitle>
            {c.distinct > c.items.length && (
              <p className="text-xs text-muted-foreground">{int(c.distinct)} respostas diferentes; as 8 mais comuns</p>
            )}
          </CardHeader>
          <CardContent>
            <HBars items={c.items} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
