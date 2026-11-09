import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { SlidingTabsList } from "@/components/dashboard/SlidingTabsList";
import { InfoTip } from "@/components/InfoTip";

export interface CardTab<T extends string> {
  value: T;
  label: string;
  info: string;
}

// Abas internas de um card, no padrão de "Ingressos emitidos", com o "i" da aba ativa ao lado
// (o "i" não pode ficar dentro do botão da aba).
export function CardTabs<T extends string>({ tabs, value, onChange }: { tabs: CardTab<T>[]; value: T; onChange: (v: T) => void }) {
  const ativa = tabs.find((t) => t.value === value) ?? tabs[0];
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="min-w-0 max-w-full">
        {/* Sem espaço, as abas quebram em mais linhas dentro do card em vez de vazar. */}
        <SlidingTabsList value={value} className="h-auto min-h-9 max-w-full flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="relative z-[1] px-3 py-1.5 text-xs data-[state=active]:bg-transparent data-[state=active]:text-background">
              {t.label}
            </TabsTrigger>
          ))}
        </SlidingTabsList>
      </Tabs>
      <InfoTip title={ativa.label} text={ativa.info} />
    </div>
  );
}
