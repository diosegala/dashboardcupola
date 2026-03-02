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

async function fetchCampaignAnalytics(campaignId: string, accessToken: string): Promise<Record<string, number> | null> {
  try {
    const url = `https://api.rd.services/platform/analytics/emails/${campaignId}`;
    const res = await fetchWithRetry(url, accessToken);
    if (!res) return null;
    if (!res.ok) {
      const text = await res.text();
      console.warn(`sync-rd-station - analytics for ${campaignId} failed ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`sync-rd-station - analytics error for ${campaignId}: ${err.message}`);
    return null;
  }
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

    // Staleness check: auto-reset if stuck syncing for > 5 min
    if (integration.sync_status === "syncing") {
      const updatedAt = new Date(integration.updated_at).getTime();
      if (updatedAt < Date.now() - 5 * 60 * 1000) {
        console.log("sync-rd-station - resetting stale syncing status");
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
      await supabase.from("integrations").update({ sync_status: "error", error_message: "Credenciais OAuth ausentes (client_id, client_secret ou refresh_token)" }).eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing OAuth credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("integrations").update({ sync_status: "syncing", error_message: null }).eq("id", integration.id);

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Step 1: Fetch campaign list from /platform/emails
    const allEmails: any[] = [];
    let page = 1;
    const pageSize = 10;
    let rateLimited = false;

    while (true) {
      const url = `https://api.rd.services/platform/emails?page_size=${pageSize}&page=${page}`;
      console.log(`sync-rd-station - fetching emails page ${page}`);
      const res = await fetchWithRetry(url, accessToken);

      if (!res) { rateLimited = true; break; }
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

      if (emails.length < pageSize) break;
      page++;
      if (page > 50) break;
      await delay(1500);
    }

    console.log(`sync-rd-station - total emails fetched: ${allEmails.length}`);

    // Deduplicate
    const dedupMap = new Map<string, any>();
    for (const e of allEmails) {
      const key = String(e.id ?? e.campaign_id ?? e.rd_campaign_id);
      dedupMap.set(key, e);
    }
    const uniqueCampaigns = Array.from(dedupMap.values());

    // Step 2: Fetch analytics for each campaign
    console.log(`sync-rd-station - fetching analytics for ${uniqueCampaigns.length} campaigns`);
    const analyticsMap = new Map<string, Record<string, number>>();

    for (const campaign of uniqueCampaigns) {
      const campaignId = String(campaign.id ?? campaign.campaign_id ?? campaign.rd_campaign_id);
      const analytics = await fetchCampaignAnalytics(campaignId, accessToken);
      if (analytics) {
        analyticsMap.set(campaignId, analytics);
      }
      await delay(1500); // Throttle to avoid rate limits
    }

    console.log(`sync-rd-station - analytics fetched for ${analyticsMap.size} campaigns`);

    // Step 3: Build rows merging campaign metadata + analytics
    const rows = uniqueCampaigns.map((e: any) => {
      const campaignId = String(e.id ?? e.campaign_id ?? e.rd_campaign_id);
      const stats = analyticsMap.get(campaignId);

      const totalSent = stats?.contacts_count ?? e.total_sent ?? e.sent ?? e.contacts_count ?? 0;
      const totalOpened = stats?.email_opened_count ?? e.total_opened ?? e.opened ?? 0;
      const totalClicked = stats?.email_clicked_count ?? e.total_clicked ?? e.clicked ?? 0;
      const unsubscribes = stats?.email_unsubscribed_count ?? e.unsubscribes ?? e.unsubscribed ?? 0;

      return {
        rd_campaign_id: campaignId,
        name: e.name ?? e.title ?? null,
        subject: e.subject ?? null,
        sent_at: e.sent_at ?? e.send_at ?? e.delivered_at ?? null,
        total_sent: totalSent,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        open_rate: totalSent > 0 ? totalOpened / totalSent : 0,
        click_rate: totalSent > 0 ? totalClicked / totalSent : 0,
        unsubscribes: unsubscribes,
        synced_at: new Date().toISOString(),
      };
    });

    // Step 4: Upsert
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("email_campaigns").upsert(chunk, { onConflict: "rd_campaign_id" });
      if (error) throw error;
    }

    if (rateLimited && rows.length === 0) {
      await supabase.from("integrations").update({ sync_status: "error", error_message: "Rate limit do RD Station atingido. Tente novamente em alguns minutos." }).eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Rate limit atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const statusMsg = rateLimited ? `Sincronização parcial: ${rows.length} campanhas salvas. Rate limit atingido.` : null;

    await supabase.from("integrations").update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: statusMsg }).eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, campaigns: rows.length, analytics_fetched: analyticsMap.size, partial: rateLimited }),
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
