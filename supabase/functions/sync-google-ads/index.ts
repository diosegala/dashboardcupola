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
      .eq("name", "google_ads")
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Google Ads integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get credentials
    const creds = (integration.credentials as Record<string, string>) ?? {};
    const clientId = (creds.client_id || "").trim();
    const clientSecret = (creds.client_secret || "").trim();
    const refreshToken = (creds.refresh_token || "").trim();
    const developerToken = (creds.developer_token || "").trim();
    const customerId = (creds.customer_id || "").trim().replace(/-/g, "");
    const managerCustomerId = (creds.manager_customer_id || "").trim().replace(/-/g, "");

    if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credenciais ausentes (client_id, client_secret, refresh_token, developer_token ou customer_id)" })
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

    // 4. Obtain access token via OAuth2 refresh
    const tokenRes = await fetchWithRetry(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      }
    );

    const accessToken = tokenRes.access_token;
    if (!accessToken) {
      throw new Error("Failed to obtain access token: " + JSON.stringify(tokenRes));
    }
    console.log("sync-google-ads - access token obtained");

    // 5. Call Google Ads API v18 searchStream
    const gaqlQuery = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        segments.date
      FROM ad_group
      WHERE segments.date DURING LAST_30_DAYS
    `.trim();

    const searchUrl = `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:searchStream`;
    console.log("sync-google-ads - calling:", searchUrl);

    const searchHeaders: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    if (managerCustomerId) {
      searchHeaders["login-customer-id"] = managerCustomerId;
    }

    const searchRes = await fetchWithRetry(searchUrl, {
      method: "POST",
      headers: searchHeaders,
      body: JSON.stringify({ query: gaqlQuery }),
    });

    // searchStream returns an array of result batches
    const batches = Array.isArray(searchRes) ? searchRes : [searchRes];
    const allResults: any[] = [];
    for (const batch of batches) {
      if (batch.results && Array.isArray(batch.results)) {
        allResults.push(...batch.results);
      }
    }

    console.log(`sync-google-ads - fetched ${allResults.length} rows`);

    // 6. Map and upsert
    const rows = allResults.map((r: any) => ({
      source: "google_ads",
      date: r.segments?.date ?? null,
      campaign_id: r.campaign?.id ? String(r.campaign.id) : null,
      campaign_name: r.campaign?.name ?? null,
      ad_set_id: r.adGroup?.id ? String(r.adGroup.id) : "",
      ad_set_name: r.adGroup?.name ?? null,
      impressions: parseInt(r.metrics?.impressions ?? "0") || 0,
      clicks: parseInt(r.metrics?.clicks ?? "0") || 0,
      spend: (parseInt(r.metrics?.costMicros ?? "0") || 0) / 1_000_000,
      ctr: parseFloat(r.metrics?.ctr ?? "0") || 0,
      cpc: (parseInt(r.metrics?.averageCpc ?? "0") || 0) / 1_000_000,
      cpm: (parseInt(r.metrics?.averageCpm ?? "0") || 0) / 1_000_000,
      conversions: Math.round(parseFloat(r.metrics?.conversions ?? "0") || 0),
      synced_at: new Date().toISOString(),
    }));

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("ad_metrics")
        .upsert(chunk, { onConflict: "source,date,ad_set_id" });
      if (error) throw error;
    }

    // 7. Success
    await supabase
      .from("integrations")
      .update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, rows: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-google-ads error:", err);

    await supabase
      .from("integrations")
      .update({ sync_status: "error", error_message: err.message?.slice(0, 500) })
      .eq("name", "google_ads");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 500)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
