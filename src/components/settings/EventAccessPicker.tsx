import { useEvent } from "@/hooks/useEvent";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ADMIN_ROLE } from "@/lib/roles";
import type { EventAccess } from "@/lib/eventAccess";

// Mesmo bloco no convite e na edição. Admin vê todos os eventos pelo papel, então o bloco some.
export function EventAccessPicker({ id, role, value, onChange }: {
  id: string;
  role: string;
  value: EventAccess;
  onChange: (v: EventAccess) => void;
}) {
  const { events } = useEvent();
  const list = events.filter((e) => e.id);
  if (role === ADMIN_ROLE) {
    return <p className="text-xs text-muted-foreground">Admin vê todos os eventos.</p>;
  }

  const chosen = list.filter((e) => value.eventIds.includes(e.id as string));
  const toggle = (eventId: string, on: boolean) =>
    onChange({ ...value, eventIds: on ? [...value.eventIds, eventId] : value.eventIds.filter((x) => x !== eventId) });

  return (
    <div className="space-y-2">
      <Label>Acesso a eventos</Label>
      <RadioGroup
        value={value.allEvents ? "all" : "some"}
        onValueChange={(v) => onChange({ ...value, allEvents: v === "all" })}
        className="gap-2"
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <RadioGroupItem value="all" id={`${id}-all`} /> Todos os eventos, inclusive os próximos
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <RadioGroupItem value="some" id={`${id}-some`} /> Só eventos específicos
        </label>
      </RadioGroup>
      {!value.allEvents && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between rounded-xl px-3 py-2 text-left font-normal">
                <span className={chosen.length ? "" : "text-muted-foreground"}>
                  {chosen.length === 0 ? "Escolher eventos" : chosen.length === 1 ? chosen[0].name : `${chosen.length} eventos selecionados`}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
              <div className="max-h-60 space-y-0.5 overflow-auto">
                {list.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                    <Checkbox checked={value.eventIds.includes(e.id as string)} onCheckedChange={(v) => toggle(e.id as string, !!v)} />
                    {e.name}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <p className="flex gap-2 rounded-xl bg-warn-bg p-2 text-xs text-warn">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {chosen.length
              ? `Esta pessoa verá apenas: ${chosen.map((e) => e.name).join(", ")}. Eventos novos não aparecem para ela automaticamente.`
              : "Nenhum evento marcado: esta pessoa não verá nenhum evento."}
          </p>
        </>
      )}
    </div>
  );
}
