import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth check for manual calls
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // 1. Get integration record
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("name", "sympla")
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Sympla integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get credentials (DB priority, then env fallback)
    const creds = (integration.credentials as Record<string, string>) ?? {};
    const apiToken = (creds.api_token || Deno.env.get("SYMPLA_API_TOKEN") || "").trim();
    const defaultEventId = (creds.event_id || Deno.env.get("SYMPLA_EVENT_ID") || "").trim();

    // Check if a specific event_id was passed in the request body
    let bodyEventId = "";
    try {
      const body = await req.json();
      bodyEventId = (body?.event_id || "").trim();
    } catch {
      // no body or invalid JSON — use default
    }

    const eventId = bodyEventId || defaultEventId;
    console.log("sync-sympla - eventId:", eventId, "token prefix:", apiToken.slice(0, 8) + "...");

    if (!apiToken || !eventId) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credenciais ausentes (api_token ou event_id)" })
        .eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Set status to syncing
    await supabase
      .from("integrations")
      .update({ sync_status: "syncing", error_message: null })
      .eq("id", integration.id);

    // 4. Fetch all participants with pagination + retry
    const allParticipants: any[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const url = `https://api.sympla.com.br/public/v1.5.1/events/${eventId}/participants?page=${page}&page_size=200`;
      console.log("sync-sympla - fetching:", url);
      const data = await fetchWithRetry(url, apiToken);
      if (data.data) {
        allParticipants.push(...data.data);
      }
      hasNext = data.pagination?.has_next ?? false;
      page++;
    }

    // 5. Upsert each participant as individual ticket
    const rows = allParticipants.map((p: any) => ({
      sympla_order_id: String(p.id), // participant id = unique per ticket
      ticket_type: p.ticket_name ?? p.ticket_title ?? null,
      ticket_type_id: p.ticket_number ? String(p.ticket_number) : null,
      quantity: 1,
      unit_price: parseFloat(p.ticket_sale_price ?? "0") || 0,
      total_price: parseFloat(p.ticket_sale_price ?? "0") || 0,
      buyer_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      buyer_email: p.email ?? null,
      sold_at: p.order_approved_date || p.order_date || null,
      status: mapStatus(p.order_status),
      event_id: eventId,
      synced_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("ticket_sales")
        .upsert(chunk, { onConflict: "sympla_order_id" });
      if (error) throw error;
    }

    // 6. Success
    await supabase
      .from("integrations")
      .update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, participants: allParticipants.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-sympla error:", err);

    // Update integration with error
    await supabase
      .from("integrations")
      .update({ sync_status: "error", error_message: err.message?.slice(0, 500) })
      .eq("name", "sympla");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapStatus(status: string | null): string {
  if (!status) return "unknown";
  const map: Record<string, string> = { A: "approved", P: "pending", R: "refunded" };
  return map[status] ?? status;
}

async function fetchWithRetry(url: string, token: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { s_token: token, Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sympla API ${res.status}: ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
