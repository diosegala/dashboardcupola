import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  incompleteOrders,
  isApprovedOrder,
  keepsTicket,
  mergeOrders,
  mergeParticipants,
  partialSyncMessage,
  participantPrice,
  pendingToCheck,
  participantsToCancel,
  PENDING_PREFIX,
  ticketKey,
} from "../_shared/sympla-rules.ts";

const isApproved = (status: string) => status.toLowerCase() === "approved";

// Pedidos conferidos um a um por sincronização (o que passar disso fica para a próxima e aparece no aviso).
const MAX_ORDER_CHECKS = 60;

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
    // Pedidos aprovados que seguem sem todos os ingressos depois de todas as buscas (aviso na tela Integrações).
    const avisos: string[] = [];
    for (const { eventId, token: apiToken } of targets) {
    const api = "https://api.sympla.com.br/public";
    const base = `${api}/v1.5.1/events/${eventId}`;

    // 4. Pedidos aprovados do evento: trazem cupom, UTM, forma de pagamento e o valor líquido do pedido. Lidos nas duas
    // versões da API, porque a 1.5.1 deixa pedidos de fora (ver mergeOrders). Se as duas falharem, a sincronização
    // segue sem cupom e ninguém é cancelado (ver participantsToCancel).
    let pedidos151: any[] = [];
    let pedidos160: any[] = [];
    let erroPedidos160: string | null = null;
    try {
      pedidos151 = await fetchAllPages(`${base}/orders`, apiToken);
    } catch (err: any) {
      console.error("sync-sympla - pedidos 1.5.1 indisponíveis:", err.message);
    }
    try {
      pedidos160 = await fetchCursorPages(`${api}/v1.6.0/events/${eventId}/orders`, apiToken, 200);
    } catch (err: any) {
      erroPedidos160 = String(err.message ?? err).slice(0, 300);
      console.error("sync-sympla - pedidos 1.6.0 indisponíveis:", erroPedidos160);
    }
    const juncaoPedidos = mergeOrders(pedidos151, pedidos160);
    const ordersById = juncaoPedidos.orders;
    // Diagnóstico (só no resumo, nada é gravado): pedidos em qualquer status, para achar os que aparecem confirmados na
    // tela da Sympla e faltam na lista padrão. Em 10/11/2026 a tela tinha 91 confirmados e as listas, 88.
    const { resumo: pedidosTodosStatus, lista: todosOsStatus } = await diagnosticoPedidos(base, `${api}/v1.6.0/events/${eventId}`, apiToken, ordersById);

    // 4b. Pedido que a lista dá como pendente: consulta o próprio pedido, que traz o status atual. Boleto pago depois da
    // compra entra como aprovado (os ingressos vêm na conferência por pedido, logo abaixo).
    const pendentesConferidos: { id: string; status_atual: string | null }[] = [];
    for (const id of pendingToCheck(todosOsStatus, new Set(ordersById.keys())).slice(0, MAX_ORDER_CHECKS)) {
      const atual = await orderDetail(api, eventId, id, apiToken);
      pendentesConferidos.push({ id, status_atual: atual ? String(atual.order_status ?? atual.status ?? "") || null : null });
      if (atual && isApprovedOrder({ order_status: atual.order_status ?? atual.status })) {
        const listado = todosOsStatus.find((o: any) => String(o.id) === id) ?? {};
        const semNulos = Object.fromEntries(Object.entries(atual).filter(([, v]) => v != null));
        ordersById.set(id, { ...listado, ...semNulos, id, order_status: "A" });
      }
      await new Promise((r) => setTimeout(r, 250));
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
    let juncao = mergeParticipants(legado, atual, savedKeyByTicket, new Set(ordersById.keys()));

    // 5a. Pedido aprovado cujos ingressos não vieram nas listas gerais: busca os participantes do próprio pedido.
    // Dado exato da Sympla, nada estimado. Falha num pedido não interrompe a sincronização; o que faltar vira aviso.
    const faltando = incompleteOrders(Array.from(ordersById.values()), juncao.participants.map((m) => m.p));
    const doPedido: any[] = [];
    let consultasComFalha = 0;
    for (const o of faltando.slice(0, MAX_ORDER_CHECKS)) {
      const lista = await participantsOfOrder(api, eventId, String(o.id), apiToken);
      if (lista === null) consultasComFalha++;
      (lista ?? []).forEach((p: any) => doPedido.push({ ...p, order_id: p.order_id ?? o.id }));
      await new Promise((r) => setTimeout(r, 250));
    }
    if (doPedido.length) juncao = mergeParticipants(legado, [...atual, ...doPedido], savedKeyByTicket, new Set(ordersById.keys()));
    const statusDe = (p: any) => ordersById.get(String(p.order_id ?? ""))?.order_status ?? p.order_status;
    const merged = juncao.participants.filter((m) => keepsTicket(statusDe(m.p)));
    const allParticipants = merged.map((m) => m.p);
    const aprovadosNaLista = merged.filter((m) => isApproved(mapStatus(statusDe(m.p))));
    const aindaIncompletos = incompleteOrders(Array.from(ordersById.values()), allParticipants).map((o: any) => String(o.id));
    avisos.push(...aindaIncompletos);
    const resumoEvento = {
      evento: eventId,
      pedidos_1_5_1: pedidos151.length,
      pedidos_1_6_0: juncaoPedidos.stats.pedidos_1_6_0,
      pedidos_novos_1_6_0: juncaoPedidos.stats.novos,
      descartada_pedidos_1_6_0: juncaoPedidos.stats.descartada,
      erro_pedidos_1_6_0: erroPedidos160,
      pedidos_conferidos_um_a_um: Math.min(faltando.length, MAX_ORDER_CHECKS),
      ingressos_recuperados_por_pedido: doPedido.length,
      consultas_por_pedido_com_falha: consultasComFalha,
      pedidos_todos_status: pedidosTodosStatus,
      pendentes_conferidos_por_pedido: pendentesConferidos,
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
      pedidos_incompletos: aindaIncompletos.length,
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
      .update({ sync_status: "idle", last_synced_at: new Date().toISOString(), error_message: partialSyncMessage(avisos) })
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

// Pedidos em qualquer status nas duas versões (1.5.1 com status=true, 1.6.0 com cancelled_filter=include): contagem
// por status e os pedidos que não estão na lista padrão, só com id, status e datas (sem dado do comprador).
async function diagnosticoPedidos(base151: string, base160: string, token: string, padrao: Map<string, any>) {
  const fontes: [string, () => Promise<any[]>][] = [
    ["v1_5_1", () => fetchAllPages(`${base151}/orders?status=true`, token)],
    ["v1_6_0", () => fetchCursorPages(`${base160}/orders?cancelled_filter=include`, token, 200)],
  ];
  const out: Record<string, unknown> = {};
  const todos: any[] = [];
  for (const [nome, ler] of fontes) {
    try {
      const lista = await ler();
      todos.push(...lista);
      const porStatus: Record<string, number> = {};
      lista.forEach((o: any) => {
        const s = String(o.order_status ?? o.status ?? "?");
        porStatus[s] = (porStatus[s] ?? 0) + 1;
      });
      out[nome] = {
        total: lista.length,
        por_status: porStatus,
        fora_da_lista_padrao: lista
          .filter((o: any) => !padrao.has(String(o.id)))
          .slice(0, 30)
          .map((o: any) => ({
            id: String(o.id),
            status: o.order_status ?? o.status ?? null,
            criado: o.order_date ?? o.created_at ?? null,
            aprovado: o.approved_date ?? o.order_approved_date ?? null,
            atualizado: o.updated_date ?? o.order_updated_date ?? null,
          })),
      };
    } catch (err: any) {
      out[nome] = { erro: String(err.message ?? err).slice(0, 200) };
    }
  }
  return { resumo: out, lista: todos };
}

// Pedido específico com o status atual: 1.6.0 primeiro, depois 1.5.1. Devolve null quando as duas falham.
async function orderDetail(api: string, eventId: string, orderId: string, token: string): Promise<any | null> {
  for (const versao of ["v1.6.0", "v1.5.1"]) {
    try {
      const data = await fetchWithRetry(`${api}/${versao}/events/${eventId}/orders/${encodeURIComponent(orderId)}`, token);
      const pedido = data?.data ?? data;
      if (pedido && typeof pedido === "object") return pedido;
    } catch (err: any) {
      console.error(`sync-sympla - pedido ${orderId} (${versao}):`, err.message);
    }
  }
  return null;
}

// Participantes de um pedido: 1.6.0 primeiro, depois 1.5.1. Devolve null quando as duas falham.
async function participantsOfOrder(api: string, eventId: string, orderId: string, token: string): Promise<any[] | null> {
  const caminho = `events/${eventId}/orders/${encodeURIComponent(orderId)}/participants?timezone=America/Sao_Paulo`;
  try {
    return await fetchCursorPages(`${api}/v1.6.0/${caminho}`, token);
  } catch (err: any) {
    console.error(`sync-sympla - participantes 1.6.0 do pedido ${orderId}:`, err.message);
  }
  try {
    return await fetchAllPages(`${api}/v1.5.1/${caminho}`, token);
  } catch (err: any) {
    console.error(`sync-sympla - participantes 1.5.1 do pedido ${orderId}:`, err.message);
    return null;
  }
}

// Todas as páginas de uma lista da API 1.6.0, paginada por cursor (pagination.next_cursor). Pedidos aceitam até 200
// por página; participantes, até 500.
async function fetchCursorPages(url: string, token: string, pageSize = 500): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  const sep = url.includes("?") ? "&" : "?";
  for (let i = 0; i < 500; i++) {
    const data = await fetchWithRetry(`${url}${sep}page_size=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, token);
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
