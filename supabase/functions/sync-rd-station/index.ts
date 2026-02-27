import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://api.rd.services/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RD Station OAuth token refresh failed ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  return data.access_token;
}

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

    const creds = (integration.credentials as Record<string, string>) ?? {};
    const clientId = (creds.client_id || "").trim();
    const clientSecret = (creds.client_secret || "").trim();
    const refreshToken = (creds.refresh_token || "").trim();

    if (!clientId || !clientSecret || !refreshToken) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credenciais OAuth ausentes (client_id, client_secret ou refresh_token)" })
        .eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing OAuth credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("integrations")
      .update({ sync_status: "syncing", error_message: null })
      .eq("id", integration.id);

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    const allEmails: any[] = [];
    let page = 1;
    const pageSize = 25;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Returns response or null if permanently rate limited
    const fetchWithRetry = async (url: string): Promise<Response | null> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const waitMs = (30 + attempt * 30) * 1000;
          console.log(`sync-rd-station - retry ${attempt}, waiting ${waitMs / 1000}s`);
          await delay(waitMs);
        }
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        if (res.status === 429) {
          console.log(`sync-rd-station - rate limited (attempt ${attempt + 1})`);
          await res.text();
          continue;
        }
        return res;
      }
      return null;
    };

    let rateLimited = false;

    while (true) {
      const url = `https://api.rd.services/platform/emails?page_size=${pageSize}&page=${page}`;
      console.log(`sync-rd-station - fetching page ${page}`);

      const res = await fetchWithRetry(url);

      if (!res) {
        rateLimited = true;
        break;
      }

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

      if ((Array.isArray(emails) ? emails.length : 0) < pageSize) break;
      page++;
      if (page > 50) break;
      await delay(5000);
    }

    console.log(`sync-rd-station - total emails fetched: ${allEmails.length}, rateLimited: ${rateLimited}`);

    // Upsert whatever we got (even partial)
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

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("email_campaigns")
        .upsert(chunk, { onConflict: "rd_campaign_id" });
      if (error) throw error;
    }

    // If rate limited and got nothing, report error
    if (rateLimited && rows.length === 0) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Rate limit do RD Station atingido. Tente novamente em alguns minutos." })
        .eq("id", integration.id);
      return new Response(
        JSON.stringify({ error: "Rate limit atingido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusMsg = rateLimited
      ? `Sincronização parcial: ${rows.length} campanhas salvas. Rate limit atingido.`
      : null;

    await supabase
      .from("integrations")
      .update({
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
        error_message: statusMsg,
      })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, campaigns: rows.length, partial: rateLimited }),
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
