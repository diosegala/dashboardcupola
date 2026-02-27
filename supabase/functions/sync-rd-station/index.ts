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
      .eq("name", "rd_station")
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "RD Station integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get credentials
    const creds = (integration.credentials as Record<string, string>) ?? {};
    const apiToken = (creds.api_token || "").trim();

    if (!apiToken) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credencial ausente (api_token)" })
        .eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing api_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Set status to syncing
    await supabase
      .from("integrations")
      .update({ sync_status: "syncing", error_message: null })
      .eq("id", integration.id);

    // 4. Fetch email campaigns from RD Station Marketing API v2 with pagination
    const allEmails: any[] = [];
    let page = 1;
    const pageSize = 50;

    while (true) {
      const url = `https://api.rd.services/platform/emails?page_size=${pageSize}&page=${page}`;
      console.log(`sync-rd-station - fetching page ${page}`);

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`RD Station API ${res.status}: ${text.slice(0, 500)}`);
      }

      const data = await res.json();
      const emails = data.items ?? data.emails ?? data;

      if (Array.isArray(emails) && emails.length > 0) {
        allEmails.push(...emails);
      } else {
        break;
      }

      // Stop if we got fewer than page_size (last page)
      if ((Array.isArray(emails) ? emails.length : 0) < pageSize) break;
      page++;
      // Safety limit
      if (page > 50) break;
    }

    console.log(`sync-rd-station - total emails fetched: ${allEmails.length}`);

    // 5. Map and upsert into email_campaigns
    const rows = allEmails.map((e: any) => ({
      rd_campaign_id: String(e.id ?? e.campaign_id ?? e.rd_campaign_id),
      name: e.name ?? e.title ?? null,
      subject: e.subject ?? null,
      sent_at: e.sent_at ?? e.send_at ?? e.delivered_at ?? null,
      total_sent: e.total_sent ?? e.sent ?? e.contacts_count ?? 0,
      total_opened: e.total_opened ?? e.opened ?? 0,
      total_clicked: e.total_clicked ?? e.clicked ?? 0,
      open_rate: e.open_rate ?? (e.total_sent > 0 ? (e.total_opened ?? 0) / e.total_sent : 0),
      click_rate: e.click_rate ?? (e.total_sent > 0 ? (e.total_clicked ?? 0) / e.total_sent : 0),
      unsubscribes: e.unsubscribes ?? e.unsubscribed ?? 0,
      synced_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("email_campaigns")
        .upsert(chunk, { onConflict: "rd_campaign_id" });
      if (error) throw error;
    }

    // 6. Success
    await supabase
      .from("integrations")
      .update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, campaigns: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-rd-station error:", err);

    await supabase
      .from("integrations")
      .update({ sync_status: "error", error_message: err.message?.slice(0, 500) })
      .eq("name", "rd_station");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
