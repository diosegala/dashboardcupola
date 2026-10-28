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
    const globalToken = (creds.api_token || Deno.env.get("SYMPLA_API_TOKEN") || "").trim();
    const defaultEventId = (creds.event_id || Deno.env.get("SYMPLA_EVENT_ID") || "").trim();

    // Check if a specific event_id was passed in the request body
    let bodyEventId = "";
    try {
      const body = await req.json();
      bodyEventId = (body?.event_id || "").trim();
    } catch {
      // no body or invalid JSON — use default
    }

    // Eventos a sincronizar: o pedido explícito; senão todos os eventos ativos com ID da Sympla (cada um com o seu
    // token, se tiver); senão o evento da integração geral, enquanto a tabela de eventos não existir.
    const targets: { eventId: string; token: string }[] = [];
    if (bodyEventId) {
      targets.push({ eventId: bodyEventId, token: globalToken });
    } else {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, sympla_event_id")
        .eq("is_active", true)
        .not("sympla_event_id", "is", null);
      if (eventsError) {
        if (defaultEventId) targets.push({ eventId: defaultEventId, token: globalToken });
      } else {
        const { data: overrides } = await supabase
          .from("event_integrations")
          .select("event_id, credentials")
          .eq("integration_name", "sympla");
        for (const e of events ?? []) {
          const own = (overrides ?? []).find((o: any) => o.event_id === e.id)?.credentials?.api_token;
          targets.push({ eventId: String(e.sympla_event_id).trim(), token: String(own || globalToken).trim() });
        }
      }
    }
    console.log("sync-sympla - eventos:", targets.map((t) => t.eventId).join(", "));

    if (!targets.length || targets.some((t) => !t.token || !t.eventId)) {
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

    let totalParticipants = 0;
    for (const { eventId, token: apiToken } of targets) {
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

    // 4b. Pedidos do evento: trazem o cupom usado. Se falhar, a sincronização segue sem cupom.
    const ordersById = new Map<string, any>();
    try {
      let orderPage = 1;
      let hasNextOrder = true;
      while (hasNextOrder) {
        const url = `https://api.sympla.com.br/public/v1.5.1/events/${eventId}/orders?page=${orderPage}&page_size=200`;
        const data = await fetchWithRetry(url, apiToken);
        (data.data ?? []).forEach((o: any) => ordersById.set(String(o.id), o));
        hasNextOrder = data.pagination?.has_next ?? false;
        orderPage++;
      }
    } catch (err: any) {
      console.error("sync-sympla - pedidos indisponíveis:", err.message);
    }

    // Só os nomes dos campos do formulário vão para o log (nunca as respostas), para mapear região e porte.
    const formLabels = new Set<string>();
    allParticipants.forEach((p: any) => (p.custom_form ?? []).forEach((f: any) => formLabels.add(String(f.name ?? f.label ?? ""))));
    console.log("sync-sympla - campos do formulário:", Array.from(formLabels).join(" | "));

    // 5. Upsert each participant as individual ticket (deduplicate by sympla_order_id)
    const rowMap = new Map<string, any>();
    allParticipants.forEach((p: any) => {
      const key = String(p.id);
      const order = ordersById.get(String(p.order_id ?? ""));
      const coupon = order?.discount_code ?? order?.coupon_code ?? p.discount_code ?? null;
      rowMap.set(key, {
        sympla_order_id: key,
        ticket_type: p.ticket_name ?? p.ticket_title ?? null,
        ticket_type_id: p.ticket_number ? String(p.ticket_number) : null,
        quantity: 1,
        unit_price: parseFloat(p.ticket_sale_price ?? "0") || 0,
        total_price: parseFloat(p.ticket_sale_price ?? "0") || 0,
        buyer_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        buyer_email: p.email ?? null,
        sold_at: p.order_date || p.order_approved_date || null,
        status: mapStatus(p.order_status),
        event_id: eventId,
        order_id: p.order_id ? String(p.order_id) : null,
        coupon_code: coupon ? String(coupon).trim().toUpperCase() : null,
        buyer_state: formAnswer(p, ["estado/uf", "uf", "cidade/estado", "estado"]),
        // O formulário não pergunta o porte; "Perfil da empresa" é o dado mais próximo.
        company_size: formAnswer(p, ["perfil da empresa", "porte"]),
        // Empresa e cargo do comprador, para identificar compras recorrentes entre eventos.
        buyer_company: formAnswerExact(p, ["empresa", "nome da empresa"]),
        buyer_role: formAnswerExact(p, ["cargo"]),
        payment_method: order?.transaction_type ?? order?.payment_method ?? null,
        utm_source: order?.utm?.utm_source ?? order?.utm_data?.utm_source ?? null,
        utm_medium: order?.utm?.utm_medium ?? order?.utm_data?.utm_medium ?? null,
        utm_campaign: order?.utm?.utm_campaign ?? order?.utm_data?.utm_campaign ?? null,
        synced_at: new Date().toISOString(),
      });
    });
    const rows = Array.from(rowMap.values());

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("ticket_sales")
        .upsert(chunk, { onConflict: "sympla_order_id" });
      if (error) throw error;
    }

    // 5b. Dados completos do participante e do pedido, numa tabela só para administradores.
    const details = allParticipants.map((p: any) => ({
      sympla_order_id: String(p.id),
      participant_data: sanitize(p),
      order_data: sanitize(ordersById.get(String(p.order_id ?? "")) ?? null),
      synced_at: new Date().toISOString(),
    }));
    for (let i = 0; i < details.length; i += 500) {
      const { error } = await supabase
        .from("ticket_sales_details")
        .upsert(details.slice(i, i + 500), { onConflict: "sympla_order_id" });
      if (error) throw error;
    }
    // 5c. Pedidos sem participante (cancelados, recusados, pendentes antigos), para a lista de pedidos a acompanhar.
    const linkedOrders = new Set(allParticipants.map((p: any) => String(p.order_id ?? "")));
    const orphanOrders = Array.from(ordersById.values())
      .filter((o: any) => !linkedOrders.has(String(o.id)))
      .map((o: any) => ({
        sympla_order_id: `pedido-${o.id}`,
        participant_data: null,
        order_data: sanitize(o),
        synced_at: new Date().toISOString(),
      }));
    for (let i = 0; i < orphanOrders.length; i += 500) {
      const { error } = await supabase
        .from("ticket_sales_details")
        .upsert(orphanOrders.slice(i, i + 500), { onConflict: "sympla_order_id" });
      if (error) throw error;
    }
    totalParticipants += allParticipants.length;
    }

    // 6. Success
    await supabase
      .from("integrations")
      .update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: null })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({ success: true, events: targets.length, participants: totalParticipants }),
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

// Resposta do formulário de inscrição para o primeiro termo encontrado, na ordem de prioridade (sem diferenciar maiúsculas).
function formAnswer(p: any, terms: string[]): string | null {
  const fields: any[] = p.custom_form ?? [];
  for (const term of terms) {
    const field = fields.find((f: any) => String(f.name ?? f.label ?? "").toLowerCase().includes(term));
    const value = field?.value != null ? String(field.value).trim() : "";
    if (value) return value;
  }
  return null;
}

// Resposta da pergunta cujo nome é exatamente um dos termos (evita confundir "Empresa" com "Perfil da empresa").
function formAnswerExact(p: any, names: string[]): string | null {
  const fields: any[] = p.custom_form ?? [];
  for (const name of names) {
    const field = fields.find((f: any) => String(f.name ?? f.label ?? "").trim().toLowerCase() === name);
    const value = field?.value != null ? String(field.value).trim() : "";
    if (value) return value;
  }
  return null;
}

// Remove dados de cartão e de acesso à conta, mesmo que a Sympla venha a enviá-los.
const BLOCKED_KEYS = /card|cartao|cartão|cvv|password|senha|token|secret|access_key/i;
function sanitize(value: any): any {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!BLOCKED_KEYS.test(k)) out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

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
