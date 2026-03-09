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
      .eq("name", "meta")
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "Meta integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get credentials
    const creds = (integration.credentials as Record<string, string>) ?? {};
    const accessToken = (creds.access_token || "").trim();
    const adAccountId = (creds.ad_account_id || "").trim();
    console.log("sync-meta - adAccountId:", adAccountId, "token prefix:", accessToken.slice(0, 8) + "...");

    if (!accessToken || !adAccountId) {
      await supabase
        .from("integrations")
        .update({ sync_status: "error", error_message: "Credenciais ausentes (access_token ou ad_account_id)" })
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

    // 4. Build date range (last 30 days)
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const timeRange = JSON.stringify({ since: formatDate(since), until: formatDate(now) });

    // Ensure ad_account_id has act_ prefix
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    // 5. Fetch insights at CAMPAIGN level with actions (fallback without actions if Meta returns error)
    const allRows: any[] = [];
    let useActions = true;

    for (const attempt of [0, 1]) {
      if (attempt === 1 && useActions) break; // no need for second attempt
      allRows.length = 0;
      let afterCursor: string | null = null;

      const baseFields = "campaign_id,campaign_name,impressions,clicks,spend,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click";
      const fieldsStr = useActions
        ? `${baseFields},actions`
        : baseFields;

      while (true) {
        const params = new URLSearchParams({
          fields: fieldsStr,
          level: "campaign",
          time_increment: "1",
          time_range: timeRange,
          limit: "500",
        });
        if (afterCursor) params.set("after", afterCursor);

        const url = `https://graph.facebook.com/v22.0/${accountId}/insights?${params}`;
        console.log("sync-meta - fetching:", url.replace(accessToken, "***"));

        try {
          const data = await fetchWithRetry(url, accessToken);

          if (data.data && data.data.length > 0) {
            allRows.push(...data.data);
          }

          afterCursor = data.paging?.cursors?.after ?? null;
          const hasNext = !!data.paging?.next;
          if (!hasNext) break;
        } catch (err: any) {
          // If actions field causes error, retry without it
          if (useActions && attempt === 0) {
            console.warn("sync-meta - actions field failed, retrying without it:", err.message);
            useActions = false;
            break;
          }
          throw err;
        }
      }

      if (!useActions && attempt === 0) continue; // retry loop without actions
      break;
    }

    // 6. Map and upsert
    const rows = allRows.map((r: any) => {
      const actions: any[] = r.actions || [];
      const linkClicks = parseInt(actions.find((a: any) => a.action_type === "link_click")?.value || "0") || 0;
      const purchaseCount = parseInt(actions.find((a: any) => a.action_type === "purchase")?.value || "0") || 0;
      const impressions = parseInt(r.impressions ?? "0") || 0;
      const totalClicks = parseInt(r.clicks ?? "0") || 0;
      const spendVal = parseFloat(r.spend ?? "0") || 0;

      return {
        source: "meta",
        date: r.date_start,
        campaign_id: r.campaign_id ?? null,
        campaign_name: r.campaign_name ?? null,
        ad_set_id: null,
        ad_set_name: null,
        impressions,
        clicks: totalClicks,
        link_clicks: linkClicks,
        purchases: purchaseCount,
        spend: spendVal,
        ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
        cpc: linkClicks > 0 ? spendVal / linkClicks : 0,
        cpm: parseFloat(r.cpm ?? "0") || 0,
        conversions: purchaseCount,
        synced_at: new Date().toISOString(),
      };
    });

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("ad_metrics")
        .upsert(chunk, { onConflict: "source,date,campaign_id" });
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
    console.error("sync-meta error:", err);

    await supabase
      .from("integrations")
      .update({ sync_status: "error", error_message: err.message?.slice(0, 500) })
      .eq("name", "meta");

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchWithRetry(url: string, token: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${url}&access_token=${token}`);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Meta API ${res.status}: ${text.slice(0, 300)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
