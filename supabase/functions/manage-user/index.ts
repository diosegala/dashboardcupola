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

    // Verify caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }
    const callerId = claimsData.claims.sub;

    // Check admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return jsonResponse({ error: "Apenas administradores podem gerenciar usuários" }, 403);
    }

    const body = await req.json();
    const { action, user_id, role } = body;

    // === LIST USERS ===
    if (action === "list_users") {
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        console.error("list_users error:", listError);
        return jsonResponse({ error: listError.message }, 400);
      }
      const users = (listData?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        email_confirmed_at: u.email_confirmed_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));
      return jsonResponse({ users });
    }

    if (!action || !user_id) {
      return jsonResponse({ error: "action e user_id são obrigatórios" }, 400);
    }

    // === UPDATE ROLE ===
    if (action === "update_role") {
      const newRole = role === "admin" ? "admin" : "viewer";
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await adminClient
        .from("user_roles")
        .insert({ user_id, role: newRole });
      if (error) {
        console.error("update_role error:", error);
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // === RESEND INVITE ===
    if (action === "resend_invite") {
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Usuário não encontrado" }, 404);
      }

      const redirectTo = "https://dashboardcupola.lovable.app/set-password";
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        userData.user.email!,
        { redirectTo }
      );
      if (inviteError) {
        console.error("resend_invite error:", inviteError);
        return jsonResponse({ error: inviteError.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // === DELETE USER ===
    if (action === "delete_user") {
      if (user_id === callerId) {
        return jsonResponse({ error: "Você não pode excluir a si mesmo" }, 400);
      }

      // Clean up related data first
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("id", user_id);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteError) {
        console.error("delete_user error:", deleteError);
        return jsonResponse({ error: deleteError.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
