import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Acesso de cada pessoa aos eventos. Admin vê tudo pelo papel; para os demais:
// allEvents = vê todos (inclusive os futuros); senão, só os eventIds liberados.
export interface EventAccess {
  allEvents: boolean;
  eventIds: string[];
}

export const EVENT_ACCESS_KEY = ["event-access"];
const NONE: EventAccess = { allEvents: false, eventIds: [] };

export function useEventAccessMap() {
  return useQuery({
    queryKey: EVENT_ACCESS_KEY,
    queryFn: async () => {
      const [scopeRes, linksRes] = await Promise.all([
        supabase.from("user_event_scope" as any).select("user_id, all_events"),
        supabase.from("event_users" as any).select("event_id, user_id"),
      ]);
      if (linksRes.error) throw linksRes.error;
      const map = new Map<string, EventAccess>();
      const get = (id: string) => {
        if (!map.has(id)) map.set(id, { allEvents: false, eventIds: [] });
        return map.get(id)!;
      };
      // Sem a tabela de alcance (antes do SQL), vale o comportamento antigo: só os liberados.
      for (const s of ((scopeRes.data ?? []) as unknown as { user_id: string; all_events: boolean }[])) get(s.user_id).allEvents = s.all_events;
      for (const l of ((linksRes.data ?? []) as unknown as { event_id: string; user_id: string }[])) get(l.user_id).eventIds.push(l.event_id);
      return { map, hasScope: !scopeRes.error };
    },
  });
}

export function accessOf(map: Map<string, EventAccess> | undefined, userId: string): EventAccess {
  return map?.get(userId) ?? NONE;
}

async function setAllEvents(userIds: string[], all: boolean) {
  const { error } = await supabase
    .from("user_event_scope" as any)
    .upsert(userIds.map((user_id) => ({ user_id, all_events: all, updated_at: new Date().toISOString() })), { onConflict: "user_id" });
  if (error) throw error;
}

async function grantEvent(userIds: string[], eventId: string) {
  const { error } = await supabase
    .from("event_users" as any)
    .upsert(userIds.map((user_id) => ({ event_id: eventId, user_id })), { onConflict: "event_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

// Ações usadas pelo convite, pela edição, pelas ações em lote e pela tela de Eventos.
export const eventAccessActions = {
  // Define o acesso completo de uma pessoa (convite e edição).
  async save(userId: string, access: EventAccess) {
    await setAllEvents([userId], access.allEvents);
    if (access.allEvents) return;
    const { error } = await supabase.from("event_users" as any).delete().eq("user_id", userId);
    if (error) throw error;
    if (access.eventIds.length) {
      const { error: insErr } = await supabase.from("event_users" as any).insert(access.eventIds.map((event_id) => ({ event_id, user_id: userId })));
      if (insErr) throw insErr;
    }
  },
  allEvents: (userIds: string[]) => setAllEvents(userIds, true),
  // Restringe aos eventos já liberados de cada um (quem não tem nenhum fica sem acesso).
  onlySpecific: (userIds: string[]) => setAllEvents(userIds, false),
  grant: grantEvent,
  async revoke(userIds: string[], eventId: string) {
    const { error } = await supabase.from("event_users" as any).delete().eq("event_id", eventId).in("user_id", userIds);
    if (error) throw error;
  },
};

export function refreshEventAccess(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: EVENT_ACCESS_KEY });
}
