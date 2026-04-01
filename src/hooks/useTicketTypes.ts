import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTicketTypes() {
  return useQuery({
    queryKey: ["ticket_types_distinct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("ticket_type")
        .not("ticket_type", "is", null);
      if (error) throw error;
      const unique = [...new Set((data ?? []).map((r) => r.ticket_type).filter(Boolean))] as string[];
      unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
      return unique;
    },
  });
}
