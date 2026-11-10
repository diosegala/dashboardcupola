import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fieldsWithActions = "campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,actions,action_values,inline_link_clicks";
const fieldsWithoutActions = "campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,inline_link_clicks";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth check for manual calls
  const authHeader = req.headers.get("Authorization");
  let chamadaAdmin = false;
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
    chamadaAdmin = true;
  }

  // Recuperação do histórico antigo: só administradores, com { "backfill_desde": "AAAA-MM-DD", "backfill_ate"?: "AAAA-MM-DD" }.
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }
  const backfillDesde = typeof body.backfill_desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.backfill_desde) ? body.backfill_desde : null;
  const backfillAte = typeof body.backfill_ate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.backfill_ate) ? body.backfill_ate : null;

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

    // Ensure ad_account_id has act_ prefix
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    if (backfillDesde && chamadaAdmin) {
      // Busca o período em janelas de um mês, já dia a dia (time_increment=1), e grava sem apagar nada.
      const fim = backfillAte ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const janelas: Array<{ since: string; until: string }> = [];
      let inicio = new Date(`${backfillDesde}T00:00:00Z`);
      const limite = new Date(`${fim}T00:00:00Z`);
      while (inicio <= limite) {
        const ultimo = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
        const ate = ultimo < limite ? ultimo : limite;
        janelas.push({ since: inicio.toISOString().slice(0, 10), until: ate.toISOString().slice(0, 10) });
        inicio = new Date(ate.getTime() + 86400000);
      }
      let gravadas = 0;
      const falhas: string[] = [];
      for (const j of janelas) {
        try {
          const rows = await fetchInsights({ accountId, accessToken, fields: fieldsWithActions, since: j.since, until: j.until, daily: true });
          const mapped = rows.map(mapRow);
          for (let i = 0; i < mapped.length; i += 500) {
            const { error } = await supabase
              .from("ad_metrics")
              .upsert(mapped.slice(i, i + 500), { onConflict: "source,date,campaign_id,ad_set_id" });
            if (error) throw error;
          }
          gravadas += mapped.length;
          console.log(`sync-meta backfill ${j.since}..${j.until}: ${mapped.length} rows`);
        } catch (err) {
          falhas.push(`${j.since}..${j.until}`);
          console.error(`sync-meta backfill ${j.since}..${j.until} failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
        }
      }
      return new Response(JSON.stringify({ success: falhas.length === 0, rows: gravadas, janelas: janelas.length, falhas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Set status to syncing
    await supabase
      .from("integrations")
      .update({ sync_status: "syncing", error_message: null })
      .eq("id", integration.id);

    // 4. Generate last 30 days array
    const dates: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }


    // 5. Fetch day by day
    const allRows: any[] = [];
    const fetchedDates: string[] = [];
    const failedDays: string[] = [];
    const partialDays: string[] = [];
    const allActionTypes = new Set<string>();

    for (const date of dates) {
      try {
        const rows = await fetchDayInsights({
          accountId,
          accessToken,
          fields: fieldsWithActions,
          date,
        });
        // Track action types
        for (const r of rows) {
          for (const a of (r.actions || [])) {
            allActionTypes.add(a.action_type);
          }
        }
        allRows.push(...rows);
        fetchedDates.push(date);
        console.log(`sync-meta - day ${date}: ${rows.length} rows with actions ✓`);
      } catch (err) {
        console.warn(`sync-meta - day ${date} failed with actions: ${err instanceof Error ? err.message.slice(0, 150) : String(err)}`);
        failedDays.push(date);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    // 6. Retry failed days once more with actions
    const stillFailedDays: string[] = [];
    for (const date of failedDays) {
      try {
        await new Promise((r) => setTimeout(r, 1000));
        const rows = await fetchDayInsights({
          accountId,
          accessToken,
          fields: fieldsWithActions,
          date,
        });
        for (const r of rows) {
          for (const a of (r.actions || [])) {
            allActionTypes.add(a.action_type);
          }
        }
        allRows.push(...rows);
        fetchedDates.push(date);
        console.log(`sync-meta - day ${date}: retry succeeded with actions ✓`);
      } catch (_err) {
        stillFailedDays.push(date);
      }
    }

    // 7. For still-failed days, fetch without actions (basic metrics only)
    for (const date of stillFailedDays) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        const rows = await fetchDayInsights({
          accountId,
          accessToken,
          fields: fieldsWithoutActions,
          date,
        });
        allRows.push(...rows);
        fetchedDates.push(date);
        partialDays.push(date);
        console.log(`sync-meta - day ${date}: ${rows.length} rows WITHOUT actions (partial)`);
      } catch (err) {
        console.error(`sync-meta - day ${date}: completely failed: ${err instanceof Error ? err.message.slice(0, 150) : String(err)}`);
      }
    }

    console.log(`sync-meta - total: ${allRows.length} rows, ${partialDays.length} partial days, action_types: ${JSON.stringify([...allActionTypes].sort())}`);

    // 8. Map rows
    const mappedRows = allRows.map(mapRow);

    // 9. Substitui só os dias buscados agora; o histórico mais antigo fica guardado.
    if (fetchedDates.length) {
      const { error: delError } = await supabase
        .from("ad_metrics")
        .delete()
        .eq("source", "meta")
        .in("date", fetchedDates);
      if (delError) throw delError;
    }

    for (let i = 0; i < mappedRows.length; i += 500) {
      const chunk = mappedRows.slice(i, i + 500);
      const { error } = await supabase.from("ad_metrics").insert(chunk);
      if (error) throw error;
    }

    // 10. Update integration status
    const errorMsg = partialDays.length > 0
      ? `Sync parcial: ${partialDays.length} dia(s) sem dados de conversão (${partialDays.join(", ")})`
      : null;

    await supabase
      .from("integrations")
      .update({
        sync_status: "idle",
        last_synced_at: new Date().toISOString(),
        error_message: errorMsg,
      })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({
        success: true,
        rows: mappedRows.length,
        actionTypesFound: [...allActionTypes],
        partialDays,
        totalDays: dates.length,
      }),
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

const findAction = (actions: any[], type: string) =>
  parseInt(actions.find((a: any) => a.action_type === type)?.value || "0") || 0;

// Converte uma linha da API (nível conjunto de anúncios, um dia) no formato de ad_metrics.
function mapRow(r: any) {
      const actions: any[] = r.actions || [];

      const inlineLinkClicks = parseInt(r.inline_link_clicks ?? "0") || 0;
      const linkClicksFromActions = findAction(actions, "link_click");
      const linkClicks = linkClicksFromActions > 0 ? linkClicksFromActions : inlineLinkClicks;

      const purchaseCount = findAction(actions, "purchase");
      const messagesCount = findAction(actions, "onsite_conversion.messaging_conversation_started_7d");
      const addToCartCount = findAction(actions, "add_to_cart");
      const leadCount = findAction(actions, "lead");
      const remarketingCount = findAction(actions, "offsite_conversion.fb_pixel_custom");
      const postEngagement = findAction(actions, "post_engagement");

      const impressions = parseInt(r.impressions ?? "0") || 0;
      const totalClicks = parseInt(r.clicks ?? "0") || 0;
      const spendVal = parseFloat(r.spend ?? "0") || 0;
      const cpmVal = impressions > 0 ? (spendVal / impressions) * 1000 : 0;
      const ctrVal = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
      const cpcVal = linkClicks > 0 ? spendVal / linkClicks : 0;

      return {
        source: "meta",
        date: r.date_start,
        campaign_id: r.campaign_id ?? "",
        campaign_name: r.campaign_name ?? null,
        ad_set_id: r.adset_id || "",
        ad_set_name: r.adset_name ?? null,
        impressions,
        clicks: totalClicks,
        link_clicks: linkClicks,
        purchases: purchaseCount,
        messages: messagesCount,
        add_to_cart: addToCartCount,
        remarketing_qualified: remarketingCount,
        post_engagement: postEngagement,
        spend: spendVal,
        ctr: ctrVal,
        cpc: cpcVal,
        cpm: cpmVal,
        conversions: purchaseCount + leadCount,
        synced_at: new Date().toISOString(),
      };
    }

// Busca um dia só (atualização dos últimos 30 dias).
function fetchDayInsights({ accountId, accessToken, fields, date }: { accountId: string; accessToken: string; fields: string; date: string }) {
  return fetchInsights({ accountId, accessToken, fields, since: date, until: date, daily: false });
}

// Busca um período; com daily=true a API devolve uma linha por dia (time_increment=1).
async function fetchInsights({
  accountId,
  accessToken,
  fields,
  since,
  until,
  daily,
}: {
  accountId: string;
  accessToken: string;
  fields: string;
  since: string;
  until: string;
  daily: boolean;
}): Promise<any[]> {
  const rows: any[] = [];
  let afterCursor: string | null = null;

  const timeRange = JSON.stringify({ since, until });

  while (true) {
    const params = new URLSearchParams({
      level: "adset",
      fields,
      time_range: timeRange,
      limit: "500",
    });
    if (daily) params.set("time_increment", "1");
    if (afterCursor) params.set("after", afterCursor);

    const url = `https://graph.facebook.com/v22.0/${accountId}/insights?${params}`;
    const data = await fetchWithRetry(url, accessToken);

    if (Array.isArray(data.data) && data.data.length > 0) {
      rows.push(...data.data);
    }

    afterCursor = data.paging?.cursors?.after ?? null;
    if (!data.paging?.next) break;
  }

  return rows;
}

async function fetchWithRetry(url: string, token: string, retries = 2): Promise<any> {
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
