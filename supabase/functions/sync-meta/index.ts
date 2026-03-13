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

    // 5. Fetch insights — TWO separate requests:
    //    A) Base metrics (inline fields, always reliable)
    //    B) Actions only (may fail with 500, handled independently)

    const baseFields = "campaign_id,campaign_name,impressions,clicks,spend,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click";

    // --- Request A: base metrics ---
    const baseRows: any[] = [];
    let afterCursor: string | null = null;
    while (true) {
      const params = new URLSearchParams({
        fields: baseFields,
        level: "campaign",
        time_increment: "1",
        time_range: timeRange,
        limit: "500",
      });
      if (afterCursor) params.set("after", afterCursor);

      const url = `https://graph.facebook.com/v22.0/${accountId}/insights?${params}`;
      console.log("sync-meta - fetching base:", url.replace(accessToken, "***"));
      const data = await fetchWithRetry(url, accessToken);

      if (data.data && data.data.length > 0) {
        baseRows.push(...data.data);
      }
      afterCursor = data.paging?.cursors?.after ?? null;
      if (!data.paging?.next) break;
    }

    // --- Request B: actions (separate, with retry, non-fatal) ---
    const actionsMap = new Map<string, any[]>(); // key = "campaign_id|date"
    try {
      let actionsCursor: string | null = null;
      while (true) {
        const params = new URLSearchParams({
          fields: "campaign_id,actions",
          level: "campaign",
          time_increment: "1",
          time_range: timeRange,
          limit: "500",
        });
        if (actionsCursor) params.set("after", actionsCursor);

        const url = `https://graph.facebook.com/v22.0/${accountId}/insights?${params}`;
        console.log("sync-meta - fetching actions:", url.replace(accessToken, "***"));
        const data = await fetchWithRetry(url, accessToken, 3);

        if (data.data) {
          // Log all unique action_types for discovery (especially for remarketing_qualified)
          const allTypes = new Set<string>();
          for (const row of data.data) {
            const actions: any[] = row.actions || [];
            for (const a of actions) {
              allTypes.add(a.action_type);
            }
            const key = `${row.campaign_id}|${row.date_start}`;
            actionsMap.set(key, actions);
          }
          if (allTypes.size > 0) {
            console.log("sync-meta - ALL action_types found:", JSON.stringify([...allTypes].sort()));
          }
        }

        actionsCursor = data.paging?.cursors?.after ?? null;
        if (!data.paging?.next) break;
      }
      console.log(`sync-meta - actions fetched successfully for ${actionsMap.size} campaign-day combos`);
    } catch (err: any) {
      console.warn("sync-meta - actions request failed (non-fatal), continuing without actions:", err.message);
    }

    // 6. Map and upsert
    const rows = baseRows.map((r: any) => {
      const key = `${r.campaign_id}|${r.date_start}`;
      const actions: any[] = actionsMap.get(key) || [];

      const findAction = (type: string) =>
        parseInt(actions.find((a: any) => a.action_type === type)?.value || "0") || 0;

      const purchaseCount = findAction("purchase");
      const messagesCount = findAction("onsite_conversion.messaging_conversation_started_7d");
      const addToCartCount = findAction("add_to_cart");

      // Remarketing Qualificado: try common custom conversion patterns
      // Log will help identify the exact action_type
      let remarketing = 0;
      for (const a of actions) {
        const t = a.action_type || "";
        if (
          t.includes("remarketing") ||
          t.includes("offsite_conversion.custom")
        ) {
          console.log(`sync-meta - potential remarketing action: ${t} = ${a.value}`);
          // For now, accumulate all custom conversions — we'll refine after seeing logs
        }
      }

      const impressions = parseInt(r.impressions ?? "0") || 0;
      const totalClicks = parseInt(r.clicks ?? "0") || 0;
      const spendVal = parseFloat(r.spend ?? "0") || 0;

      // Use inline fields (more reliable than actions array)
      const linkClicks = parseInt(r.inline_link_clicks ?? "0") || 0;
      const ctr = parseFloat(r.inline_link_click_ctr ?? "0") || 0;
      const cpc = parseFloat(r.cost_per_inline_link_click ?? "0") || 0;

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
        messages: messagesCount,
        add_to_cart: addToCartCount,
        remarketing_qualified: remarketing,
        spend: spendVal,
        ctr,
        cpc,
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
      JSON.stringify({ success: true, rows: rows.length, actionsAvailable: actionsMap.size > 0 }),
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
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
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
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
    }
  }
}
