import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Lista os eventos da conta Sympla (id, nome e datas) para o cadastro de eventos. Só administradores.
// O token fica no servidor: o navegador recebe apenas a lista.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return jsonResponse({ error: "Apenas administradores podem listar eventos da Sympla" }, 403);
    }

    const { data: integration } = await adminClient
      .from("integrations")
      .select("credentials")
      .eq("name", "sympla")
      .single();
    const creds = (integration?.credentials as Record<string, string>) ?? {};
    const apiToken = (creds.api_token || Deno.env.get("SYMPLA_API_TOKEN") || "").trim();
    if (!apiToken) {
      return jsonResponse({ error: "Token da Sympla não configurado" }, 400);
    }

    const events: { id: string; name: string; start_date: string | null; end_date: string | null }[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`https://api.sympla.com.br/public/v1.5.1/events?page=${page}&page_size=100`, {
        headers: { s_token: apiToken, Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        return jsonResponse({ error: `Sympla API ${res.status}: ${text.slice(0, 200)}` }, 502);
      }
      const data = await res.json();
      (data.data ?? []).forEach((e: any) =>
        events.push({
          id: String(e.id),
          name: e.name ?? "Sem nome",
          start_date: e.start_date ?? null,
          end_date: e.end_date ?? null,
        }),
      );
      if (!data.pagination?.has_next) break;
    }

    events.sort((a, b) => String(b.start_date ?? "").localeCompare(String(a.start_date ?? "")));
    return jsonResponse({ events });
  } catch (err: any) {
    console.error("list-sympla-events error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
