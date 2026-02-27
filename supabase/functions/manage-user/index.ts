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

    const { action, user_id, role } = await req.json();

    if (!action || !user_id) {
      return jsonResponse({ error: "action e user_id são obrigatórios" }, 400);
    }

    // === UPDATE ROLE ===
    if (action === "update_role") {
      const newRole = role === "admin" ? "admin" : "viewer";
      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id, role: newRole }, { onConflict: "user_id" });
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
