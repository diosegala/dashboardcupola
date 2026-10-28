import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://api.rd.services/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RD Station OAuth token refresh failed ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()).access_token;
}

async function fetchWithRetry(url: string, accessToken: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log("sync-rd-station - retry after 2s");
      await delay(2000);
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    if (res.status === 429) {
      console.log(`sync-rd-station - rate limited (attempt ${attempt + 1})`);
      await res.text();
      continue;
    }
    return res;
  }
  return null;
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
    // Sincronização manual só para administradores (a agendada não passa por aqui).
    const { data: isAdmin } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem sincronizar" }), {
        status: 403,
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

    // Cooldown: skip if last successful sync was < 30 min ago
    if (integration.last_synced_at) {
      const lastSynced = new Date(integration.last_synced_at).getTime();
      if (lastSynced > Date.now() - 30 * 60 * 1000) {
        console.log("sync-rd-station - skipping, recently synced");
        return new Response(JSON.stringify({ skipped: true, reason: "Recently synced" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Staleness check
    if (integration.sync_status === "syncing") {
      const updatedAt = new Date(integration.updated_at).getTime();
      if (updatedAt < Date.now() - 5 * 60 * 1000) {
        await supabase.from("integrations").update({ sync_status: "idle", error_message: "Auto-reset: status travado" }).eq("id", integration.id);
      } else {
        return new Response(JSON.stringify({ skipped: true, reason: "Already syncing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const creds = (integration.credentials as Record<string, string>) ?? {};
    const clientId = (creds.client_id || "").trim();
    const clientSecret = (creds.client_secret || "").trim();
    const refreshToken = (creds.refresh_token || "").trim();

    if (!clientId || !clientSecret || !refreshToken) {
      await supabase.from("integrations").update({ sync_status: "error", error_message: "Credenciais OAuth ausentes" }).eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing OAuth credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("integrations").update({ sync_status: "syncing", error_message: null }).eq("id", integration.id);

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Use analytics endpoint as primary source — it has all metrics
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = "2021-08-01";
    const analyticsUrl = `https://api.rd.services/platform/analytics/emails?start_date=${startDate}&end_date=${endDate}`;

    console.log("sync-rd-station - fetching analytics data");
    const res = await fetchWithRetry(analyticsUrl, accessToken);

    if (!res) {
      await supabase.from("integrations").update({ sync_status: "error", error_message: "Rate limit do RD Station atingido." }).eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Rate limit atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RD Station Analytics API ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = await res.json();
    const emailItems = data.emails ?? [];
    console.log(`sync-rd-station - analytics returned ${emailItems.length} campaigns`);

    // Map analytics data directly to email_campaigns rows
    const rows = emailItems.map((item: any) => {
      const totalSent = item.contacts_count ?? 0;
      const totalDelivered = item.email_delivered_count ?? 0;
      const totalBounced = item.email_bounced_count ?? 0;
      const totalDropped = item.email_dropped_count ?? 0;
      const totalOpened = item.email_opened_count ?? 0;
      const totalClicked = item.email_clicked_count ?? 0;
      const spamReported = item.email_spam_reported_count ?? 0;

      // Use delivered as denominator to align with RD Station UI reports
      const base = totalDelivered > 0 ? totalDelivered : totalSent;

      return {
        rd_campaign_id: String(item.campaign_id),
        name: item.campaign_name ?? null,
        subject: null,
        sent_at: item.send_at ?? null,
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_bounced: totalBounced,
        total_dropped: totalDropped,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        open_rate: base > 0 ? totalOpened / base : 0,
        click_rate: base > 0 ? totalClicked / base : 0,
        unsubscribes: item.email_unsubscribed_count ?? 0,
        spam_reported: spamReported,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert in chunks
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("email_campaigns").upsert(chunk, { onConflict: "rd_campaign_id" });
      if (error) throw error;
    }

    console.log(`sync-rd-station - upserted ${rows.length} campaigns`);

    await supabase.from("integrations").update({
      sync_status: "idle",
      last_synced_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, campaigns: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-rd-station error:", err);
    await supabase.from("integrations").update({ sync_status: "error", error_message: err.message?.slice(0, 500) }).eq("name", "rd_station");
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
