import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  incompleteOrders,
  isApprovedOrder,
  keepsTicket,
  mergeParticipants,
  participantPrice,
  participantsToCancel,
  PENDING_PREFIX,
  ticketKey,
} from "../_shared/sympla-rules.ts";

const isApproved = (status: string) => status.toLowerCase() === "approved";

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
    const resumo: any[] = [];
    for (const { eventId, token: apiToken } of targets) {
    const api = "https://api.sympla.com.br/public";
    const base = `${api}/v1.5.1/events/${eventId}`;

    // 4. Pedidos aprovados do evento (1.5.1): trazem cupom, UTM, forma de pagamento e o valor líquido do pedido.
    // Se falhar, a sincronização segue sem cupom e ninguém é cancelado (ver participantsToCancel).
    const ordersById = new Map<string, any>();
    try {
      (await fetchAllPages(`${base}/orders`, apiToken)).forEach((o: any) => ordersById.set(String(o.id), o));
    } catch (err: any) {
      console.error("sync-sympla - pedidos indisponíveis:", err.message);
    }

    // Linhas já gravadas do evento: a chave de cada ingresso (para a 1.6.0 atualizar a mesma linha, sem duplicar)
    // e a base da regra de cancelamento.
    const saved: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("sympla_order_id, order_id, ticket_type_id, status")
        .eq("event_id", eventId)
        .not("sympla_order_id", "like", `${PENDING_PREFIX}%`)
        .order("sympla_order_id")
        .range(from, from + 999);
      if (error) throw error;
      saved.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const savedKeyByTicket = new Map<string, string>();
    saved.forEach((r: any) => r.ticket_type_id && savedKeyByTicket.set(ticketKey(r.ticket_type_id), String(r.sympla_order_id)));

    // 5. Participantes: contrato legado (1.5.1) e atual (1.6.0), um por ingresso. A 1.6.0 traz os ingressos que a
    // 1.5.1 deixou de devolver; se ela falhar, segue só com a 1.5.1 e o resumo mostra o erro.
    const legado = await fetchAllPages(`${base}/participants`, apiToken);
    let atual: any[] = [];
    let erro160: string | null = null;
    try {
      atual = await fetchCursorPages(`${api}/v1.6.0/events/${eventId}/participants`, apiToken);
    } catch (err: any) {
      erro160 = String(err.message ?? err).slice(0, 300);
      console.error("sync-sympla - participantes 1.6.0 indisponíveis:", erro160);
    }
    const juncao = mergeParticipants(legado, atual, savedKeyByTicket, new Set(ordersById.keys()));
    const statusDe = (p: any) => ordersById.get(String(p.order_id ?? ""))?.order_status ?? p.order_status;
    const merged = juncao.participants.filter((m) => keepsTicket(statusDe(m.p)));
    const allParticipants = merged.map((m) => m.p);
    const aprovadosNaLista = merged.filter((m) => isApproved(mapStatus(statusDe(m.p))));
    const resumoEvento = {
      evento: eventId,
      participantes_1_5_1: legado.length,
      participantes_1_6_0: atual.length,
      erro_1_6_0: erro160,
      // Ingressos da 1.6.0 já conhecidos pela 1.5.1 ou pelo banco; sem nenhum, a 1.6.0 é descartada para não duplicar.
      reconhecidos_1_6_0: juncao.stats.reconhecidos,
      sem_numero_1_6_0: juncao.stats.semNumero,
      descartada_1_6_0: juncao.stats.descartada,
      ingressos: merged.length,
      fora_nao_pagos_cancelados: juncao.participants.length - merged.length,
      ingressos_aprovados: aprovadosNaLista.length,
      sem_pedido_na_lista: aprovadosNaLista.filter((m) => !ordersById.has(String(m.p.order_id ?? ""))).length,
      pedidos_aprovados: ordersById.size,
      pedidos_incompletos: incompleteOrders(Array.from(ordersById.values()), allParticipants).length,
    };
    resumo.push(resumoEvento);
    console.log("sync-sympla - resumo:", JSON.stringify(resumoEvento));

    // Só os nomes dos campos do formulário vão para o log (nunca as respostas), para mapear região e porte.
    const formLabels = new Set<string>();
    allParticipants.forEach((p: any) => (p.custom_form ?? []).forEach((f: any) => formLabels.add(String(f.name ?? f.label ?? ""))));
    console.log("sync-sympla - campos do formulário:", Array.from(formLabels).join(" | "));

    // 5. Upsert each participant as individual ticket (deduplicate by sympla_order_id)
    const rowMap = new Map<string, any>();
    merged.forEach(({ key, p }) => {
      const order = ordersById.get(String(p.order_id ?? ""));
      const coupon = order?.discount_code ?? order?.coupon_code ?? p.discount_code ?? null;
      rowMap.set(key, {
        sympla_order_id: key,
        ticket_type: p.ticket_name ?? p.ticket_title ?? null,
        ticket_type_id: p.ticket_number ? String(p.ticket_number) : null,
        quantity: 1,
        unit_price: participantPrice(p),
        total_price: participantPrice(p),
        buyer_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        buyer_email: p.email ?? null,
        sold_at: p.order_date || p.order_approved_date || order?.order_date || p.ticket_created_at || null,
        // A lista de pedidos é a fonte atual do status; a do participante pode estar desatualizada.
        status: mapStatus(order?.order_status ?? p.order_status),
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
        utm_content: order?.utm?.utm_content ?? order?.utm_data?.utm_content ?? null,
        synced_at: new Date().toISOString(),
      });
    });
    const rows = Array.from(rowMap.values());

    // Só participantes reais: a quantidade e o tipo vêm da Sympla, nunca de estimativa. Pedido aprovado cujo comprador
    // ainda não preencheu os nomes entra quando os participantes aparecem; até lá fica na lista de pedidos a acompanhar.
    // Regra do projeto: nenhum número do painel é estimado.

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("ticket_sales")
        .upsert(chunk, { onConflict: "sympla_order_id" });
      if (error) throw error;
    }

    // Remove as linhas de estimativa gravadas por versões anteriores ("pendente-<pedido>").
    {
      const { error } = await supabase.from("ticket_sales").delete().eq("event_id", eventId).like("sympla_order_id", `${PENDING_PREFIX}%`);
      if (error) throw error;
    }

    // Participantes que a Sympla deixou de devolver e cujo pedido saiu dos aprovados (cancelado, estornado) passam a
    // cancelados. Quem tem o pedido ainda aprovado continua contando (ver participantsToCancel).
    if (ordersById.size) {
      const aprovados = new Set(Array.from(ordersById.values()).filter(isApprovedOrder).map((o: any) => String(o.id)));
      const gone = participantsToCancel(saved.filter((r: any) => r.status !== "cancelled"), new Set(rowMap.keys()), aprovados);
      for (let i = 0; i < gone.length; i += 200) {
        const { error: cancelError } = await supabase
          .from("ticket_sales")
          .update({ status: "cancelled", synced_at: new Date().toISOString() })
          .in("sympla_order_id", gone.slice(i, i + 200));
        if (cancelError) throw cancelError;
      }
      if (gone.length) console.log("sync-sympla - participantes que saíram da Sympla:", gone.length);
    }

    // 5b. Dados completos do participante e do pedido, numa tabela só para administradores.
    const details = merged.map(({ key, p }) => ({
      sympla_order_id: key,
      // event_id garante que a página Compradores encontre o participante, venha ele de qualquer versão da API.
      participant_data: sanitize({ ...p, event_id: p.event_id ?? eventId }),
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
    // Pedido que já tem participante deixa de aparecer como pedido sem participante.
    const pedidosVinculados = Array.from(linkedOrders).filter(Boolean).map((id) => `pedido-${id}`);
    for (let i = 0; i < pedidosVinculados.length; i += 200) {
      const { error } = await supabase.from("ticket_sales_details").delete().in("sympla_order_id", pedidosVinculados.slice(i, i + 200));
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
      JSON.stringify({ success: true, events: targets.length, participants: totalParticipants, resumo }),
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

// Todas as páginas de uma lista da API 1.6.0, paginada por cursor (pagination.next_cursor).
async function fetchCursorPages(url: string, token: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 500; i++) {
    const data = await fetchWithRetry(`${url}?page_size=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, token);
    all.push(...(data?.data ?? []));
    const next = data?.pagination?.next_cursor ?? null;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return all;
}

// Todas as páginas de uma lista da API 1.5.1 (participantes, pedidos), paginada por número de página.
async function fetchAllPages(url: string, token: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 500; page++) {
    const data = await fetchWithRetry(`${url}${url.includes("?") ? "&" : "?"}page=${page}&page_size=200`, token);
    all.push(...(data?.data ?? []));
    if (!data?.pagination?.has_next) break;
  }
  return all;
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
