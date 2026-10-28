import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/Chip";
import { isEventClosed, useEvent } from "@/hooks/useEvent";

// Seletor de evento do topo. Com um único evento liberado vira rótulo fixo, sem menu.
export function EventSelector() {
  const { events, event, setEvent } = useEvent();

  if (events.length <= 1) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
        <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(176,249,10,0.2)]" />
        {event.name}
      </span>
    );
  }

  return (
    <Select value={event.slug} onValueChange={setEvent}>
      <SelectTrigger className="h-9 w-auto min-w-0 gap-2 rounded-full border-line-strong text-[13px] font-semibold sm:min-w-[200px] [&>span]:truncate" aria-label="Evento">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgba(176,249,10,0.2)]" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-2xl">
        {events.map((e) => (
          <SelectItem key={e.slug} value={e.slug} className="rounded-xl">
            <span className="flex items-center gap-2">
              {e.name}
              {isEventClosed(e) && <Chip variant="neutral" dot={false} className="px-2 py-0 text-[10px]">Encerrado</Chip>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
