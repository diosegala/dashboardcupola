import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface EventRow {
  id: string | null;
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string;
  sympla_event_id: string | null;
  previous_event_slug: string | null;
  paying_goal: number | null;
  is_active: boolean;
}

interface EventContextValue {
  events: EventRow[];
  event: EventRow;
  setEvent: (slug: string) => void;
  // false enquanto a tabela de eventos não existir no banco: o painel usa o evento padrão abaixo.
  hasEventsTable: boolean;
  isLoading: boolean;
}

const STORAGE_KEY = "cupola-evento";

// Evento usado antes do SQL da fase 8: mantém o painel exatamente como era.
const FALLBACK_EVENT: EventRow = {
  id: null,
  slug: "summit-2027",
  name: "\n",
  start_date: "2027-05-19",
  end_date: "2027-05-21",
  sympla_event_id: null,
  previous_event_slug: "summit-2026",
  paying_goal: 2000,
  is_active: true,
};

// Mantém o mesmo contexto quando o arquivo é recarregado durante o desenvolvimento.
const globalScope = globalThis as { __cupolaEventContext?: React.Context<EventContextValue | null> };
const EventContext = (globalScope.__cupolaEventContext ??= createContext<EventContextValue | null>(null));

function lastChosen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events" as any).select("*").order("end_date", { ascending: false });
      if (error) return null;
      return (data ?? []) as unknown as EventRow[];
    },
  });

  // Antes do SQL o ID da Sympla vem da integração geral.
  const fallbackSympla = useQuery({
    queryKey: ["sympla_event_ids"],
    enabled: eventsQuery.data === null,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_current_sympla_event_id");
      return { currentEventId: (data as string | null) || "" };
    },
  });

  const hasEventsTable = Array.isArray(eventsQuery.data);
  const events = useMemo<EventRow[]>(() => {
    if (hasEventsTable) {
      // Cada evento compara sempre com o evento imediatamente anterior (o último que terminou antes dele).
      const list = eventsQuery.data as EventRow[];
      return list.map((e) => ({ ...e, previous_event_slug: previousEventOf(e, list)?.slug ?? null }));
    }
    return [{ ...FALLBACK_EVENT, sympla_event_id: fallbackSympla.data?.currentEventId || null }];
  }, [hasEventsTable, eventsQuery.data, fallbackSympla.data]);

  const event = useMemo<EventRow>(() => {
    const wanted = searchParams.get("evento") ?? lastChosen();
    const found = wanted ? events.find((e) => e.slug === wanted) : undefined;
    if (found) return found;
    // Padrão: o próximo evento ativo que ainda não terminou; senão o mais recente.
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter((e) => e.is_active && e.end_date >= today).sort((a, b) => a.end_date.localeCompare(b.end_date));
    return upcoming[0] ?? events[0] ?? FALLBACK_EVENT;
  }, [events, searchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, event.slug);
    } catch {
      // sem armazenamento local: só não lembra a escolha
    }
  }, [event.slug]);

  const setEvent = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("evento", slug);
    setSearchParams(next, { replace: true });
  };

  return (
    <EventContext.Provider
      value={{ events, event, setEvent, hasEventsTable, isLoading: eventsQuery.isLoading || fallbackSympla.isLoading }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent precisa estar dentro de EventProvider");
  return ctx;
}

// Evento imediatamente anterior: o que terminou por último antes do último dia deste.
export function previousEventOf(event: { slug: string; end_date: string }, events: { slug: string; end_date: string }[]) {
  return events
    .filter((e) => e.slug !== event.slug && e.end_date < event.end_date)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
}

// Versão opcional, para componentes que também aparecem fora da área logada.
export function useOptionalEvent() {
  return useContext(EventContext);
}

export function isEventClosed(event: EventRow) {
  return new Date() > new Date(`${event.end_date}T23:59:59`);
}

// Metas do evento selecionado (antes do SQL todas as metas valem).
export function goalsOfEvent<T extends { event_id?: string | null }>(goals: T[], event: EventRow) {
  if (!event.id) return goals;
  return goals.filter((g) => g.event_id === event.id);
}
