import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── JWT / OAuth helpers ─────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64urlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ── GA4 Data API helper ─────────────────────────────────────────────

async function runReport(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<any> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// ── Main handler ────────────────────────────────────────────────────

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
      .eq("name", "google_analytics")
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "Google Analytics integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get credentials
    const creds = (integration.credentials as Record<string, string>) ?? {};
    const propertyId = (creds.property_id || "").trim();
    const serviceAccountRaw = (creds.service_account_json || "").trim();

    if (!propertyId || !serviceAccountRaw) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credenciais ausentes (property_id ou service_account_json)" })
        .eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let serviceAccount: { client_email: string; private_key: string };
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "service_account_json inválido" })
        .eq("id", integration.id);
      return new Response(JSON.stringify({ error: "Invalid service_account_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Set status to syncing
    await supabase
      .from("integrations")
      .update({ sync_status: "syncing", error_message: null })
      .eq("id", integration.id);

    // 4. Get access token
    console.log("sync-google-analytics - getting access token for", serviceAccount.client_email);
    const accessToken = await getAccessToken(
      serviceAccount.client_email,
      serviceAccount.private_key
    );

    // 5. Date range (last 30 days)
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    const startDate = since.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const dateRange = { startDate, endDate };

    // 6. Fetch main metrics (by day) — now includes conversions
    console.log("sync-google-analytics - fetching daily metrics");
    const metricsReport = await runReport(propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
      ],
    });

    // 7. Fetch top pages (aggregated over period)
    console.log("sync-google-analytics - fetching top pages");
    const pagesReport = await runReport(propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      limit: 20,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    });

    const topPages = (pagesReport.rows ?? []).map((r: any) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      views: parseInt(r.metricValues?.[0]?.value ?? "0"),
    }));

    // 8. Fetch traffic sources with expanded metrics (by day + channel)
    console.log("sync-google-analytics - fetching traffic sources by day");
    const sourcesReport = await runReport(propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }, { name: "sessionSource" }],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 10000,
    });

    // Group traffic sources by date
    const sourcesByDate = new Map<string, any[]>();
    for (const r of sourcesReport.rows ?? []) {
      const rawDate = r.dimensionValues?.[0]?.value ?? "";
      const dateKey = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const entry = {
        source: r.dimensionValues?.[1]?.value ?? "",
        sessions: parseInt(r.metricValues?.[0]?.value ?? "0"),
        conversions: parseInt(r.metricValues?.[1]?.value ?? "0"),
        avg_engagement_time: parseFloat(r.metricValues?.[2]?.value ?? "0"),
        bounce_rate: parseFloat(r.metricValues?.[3]?.value ?? "0"),
      };
      if (!sourcesByDate.has(dateKey)) sourcesByDate.set(dateKey, []);
      sourcesByDate.get(dateKey)!.push(entry);
    }

    // 9. Build upsert rows
    const rows = (metricsReport.rows ?? []).map((r: any) => {
      const rawDate = r.dimensionValues?.[0]?.value ?? "";
      const dateFormatted = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const vals = r.metricValues ?? [];
      return {
        date: dateFormatted,
        sessions: parseInt(vals[0]?.value ?? "0"),
        users: parseInt(vals[1]?.value ?? "0"),
        new_users: parseInt(vals[2]?.value ?? "0"),
        pageviews: parseInt(vals[3]?.value ?? "0"),
        bounce_rate: parseFloat(vals[4]?.value ?? "0"),
        avg_session_duration: parseFloat(vals[5]?.value ?? "0"),
        conversions: parseInt(vals[6]?.value ?? "0"),
        top_pages: topPages,
        traffic_sources: sourcesByDate.get(dateFormatted) ?? [],
        synced_at: new Date().toISOString(),
      };
    });

    console.log("sync-google-analytics - upserting", rows.length, "rows");

    // 10. Upsert site_analytics
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("site_analytics")
        .upsert(chunk, { onConflict: "date" });
      if (error) throw error;
    }

    // 10b. Fetch GA4 funnel events
    const funnelEventNames = ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase"];
    console.log("sync-google-analytics - fetching funnel events");
    const eventsReport = await runReport(propertyId, accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: funnelEventNames },
        },
      },
      limit: 10000,
    });

    const eventRows = (eventsReport.rows ?? []).map((r: any) => {
      const rawDate = r.dimensionValues?.[0]?.value ?? "";
      const dateFormatted = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      return {
        date: dateFormatted,
        event_name: r.dimensionValues?.[1]?.value ?? "",
        event_count: parseInt(r.metricValues?.[0]?.value ?? "0"),
        synced_at: new Date().toISOString(),
      };
    });

    console.log("sync-google-analytics - upserting", eventRows.length, "event rows");
    for (let i = 0; i < eventRows.length; i += 500) {
      const chunk = eventRows.slice(i, i + 500);
      const { error } = await supabase
        .from("ga4_events")
        .upsert(chunk, { onConflict: "date,event_name" });
      if (error) throw error;
    }

    // 11. Success
    await supabase
      .from("integrations")
      .update({
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, rows: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-google-analytics error:", err);

    await supabase
      .from("integrations")
      .update({ sync_status: "error", error_message: err.message?.slice(0, 500) })
      .eq("name", "google_analytics");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
