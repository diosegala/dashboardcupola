import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { atorHeaders } from "../_shared/ator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// E-mail é único no app: procura conta com o mesmo e-mail (sem diferenciar maiúsculas), inclusive pendentes.
async function emailEmUso(adminClient: any, email: string, exceto?: string): Promise<boolean> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.some((u: any) => u.id !== exceto && (u.email ?? "").trim().toLowerCase() === email)) return true;
    if (users.length < 1000) return false;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: atorHeaders("invite_user", callerId) } });
    const registrar = async (p: Record<string, unknown>) => {
      const { error } = await adminClient.rpc("registrar_atividade", { p_tela: "Configurações › Usuários", p_entidade: "usuario", ...p });
      if (error) console.error("registrar_atividade error:", error);
    };

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      await registrar({ p_acao: "acesso.negado", p_resultado: "erro", p_detalhe: "Tentou convidar usuário sem ser administrador" });
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem convidar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate body
    const { email, role, name } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Informe um e-mail válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Qualquer papel do enum app_role vale; o banco recusa um papel inexistente.
    const assignedRole = typeof role === "string" && /^[a-z_]+$/.test(role) ? role : "viewer";

    // Convidar de novo um e-mail existente (até pendente) reenviaria o convite como se fosse conta nova.
    if (await emailEmUso(adminClient, trimmedEmail)) {
      return new Response(
        JSON.stringify({ error: "Já existe um usuário com este e-mail. Para reenviar o convite, use o envelope na lista de usuários." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite user via Admin API
    const siteUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "");
    const redirectTo = `https://painel.cupola.com.br/set-password`;

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
        redirectTo,
        data: typeof name === "string" && name.trim() ? { name: name.trim().slice(0, 120) } : undefined,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      await registrar({ p_acao: "acesso.convite_enviado", p_rotulo: trimmedEmail, p_resultado: "erro", p_detalhe: inviteError.message });
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registra quem convidou (app_metadata: só o servidor altera)
    if (inviteData.user) {
      await registrar({ p_acao: "acesso.convite_enviado", p_entidade_id: inviteData.user.id, p_rotulo: [typeof name === "string" ? name.trim() : "", trimmedEmail].filter(Boolean).join(" · "), p_dados: { funcao: assignedRole } });
      await adminClient.auth.admin.updateUserById(inviteData.user.id, { app_metadata: { invited_by: callerId } });
    }

    // Assign role: a conta nunca fica sem função; se não gravar, o painel avisa.
    if (inviteData.user) {
      const { error: roleError } = await adminClient.from("user_roles").upsert(
        { user_id: inviteData.user.id, role: assignedRole },
        { onConflict: "user_id" }
      );
      if (roleError) {
        console.error("Role error:", roleError);
        await registrar({ p_acao: "permissao.papel_definido", p_entidade_id: inviteData.user.id, p_rotulo: trimmedEmail, p_resultado: "erro", p_detalhe: roleError.message });
        return new Response(
          JSON.stringify({ error: "Convite enviado, mas a função não foi salva. Escolha a função da pessoa na lista de usuários." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: inviteData.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
