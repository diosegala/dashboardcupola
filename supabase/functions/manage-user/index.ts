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
        name: (u.user_metadata as any)?.name ?? null,
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
      const newRole = role === "admin" ? "admin" : role === "seller" ? "seller" : "viewer";
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

    // === UPDATE USER (nome, e-mail, senha) ===
    if (action === "update_user") {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 120) : undefined;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
      const password = typeof body.password === "string" && body.password ? body.password : undefined;
      if (email !== undefined && !/^[^@\s]+@cupola\.com\.br$/.test(email)) {
        return jsonResponse({ error: "O e-mail deve terminar com @cupola.com.br" }, 400);
      }
      if (password !== undefined && password.length < 8) {
        return jsonResponse({ error: "A senha precisa ter pelo menos 8 caracteres" }, 400);
      }
      const changes: Record<string, unknown> = {};
      if (email) { changes.email = email; changes.email_confirm = true; }
      if (password) changes.password = password;
      if (Object.keys(changes).length) {
        const { error } = await adminClient.auth.admin.updateUserById(user_id, changes);
        if (error) {
          console.error("update_user auth error:", error);
          return jsonResponse({ error: error.message }, 400);
        }
      }
      if (name) {
        const { error } = await adminClient.from("profiles").update({ name }).eq("id", user_id);
        if (error) return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // === RESEND INVITE ===
    if (action === "resend_invite") {
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Usuário não encontrado" }, 404);
      }

      if (userData.user.email_confirmed_at) {
        // Conta já ativa: envia link de redefinição de senha em vez de convite.
        const { error: resetError } = await userClient.auth.resetPasswordForEmail(
          userData.user.email!,
          { redirectTo: "https://painel.cupola.com.br/set-password" }
        );
        if (resetError) {
          console.error("resend_invite reset error:", resetError);
          return jsonResponse({ error: resetError.message }, 400);
        }
        return jsonResponse({ success: true, sent: "reset" });
      }

      const redirectTo = "https://painel.cupola.com.br/set-password";
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        userData.user.email!,
        { redirectTo }
      );
      if (inviteError) {
        console.error("resend_invite error:", inviteError);
        return jsonResponse({ error: inviteError.message }, 400);
      }
      return jsonResponse({ success: true, sent: "invite" });
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
