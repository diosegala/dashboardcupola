import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent } from "@/hooks/useEvent";
import { setBatchCalendar, setCurrentBatchEvent, type BatchDates } from "@/lib/batchCalendar";

export interface BatchRow extends BatchDates {
  id: string;
  event_id: string;
}

export const EVENT_BATCHES_KEY = ["event-batches"];

// Lotes cadastrados em Configurações › Lotes (todos os eventos; a tabela é pequena).
export function useEventBatches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: EVENT_BATCHES_KEY,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BatchRow[]> => {
      const { data, error } = await supabase
        .from("event_batches")
        .select("id, event_id, name, start_date, end_date, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BatchRow[];
    },
  });
}

// Versão do calendário: entra na chave das vendas para o lote de cada venda ser recalculado quando as datas mudam.
let VERSAO = "";
export const batchCalendarVersion = () => VERSAO;

// Aplica o calendário às regras do painel (por id do evento e pelo id da Sympla) e refaz a tela quando muda.
export function BatchCalendarProvider({ children }: { children: ReactNode }) {
  const { data } = useEventBatches();
  const { events, event } = useEvent();
  const versao = useMemo(() => {
    const porEvento: Record<string, BatchDates[]> = {};
    (data ?? []).forEach((b) => {
      const ev = events.find((e) => e.id === b.event_id);
      [b.event_id, ev?.sympla_event_id].filter(Boolean).forEach((k) => (porEvento[k as string] ??= []).push(b));
    });
    setBatchCalendar(porEvento);
    setCurrentBatchEvent(event.id);
    VERSAO = JSON.stringify(data ?? []);
    return `${VERSAO}|${event.id}`;
  }, [data, events, event.id]);
  // A troca de lote acontece à meia-noite de Brasília: refaz a tela uma vez por minuto se o dia mudou.
  useEffect(() => {
    const dia = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const id = setInterval(() => {
      if (new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) !== dia) window.location.reload();
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return <div key={versao} className="contents">{children}</div>;
}
