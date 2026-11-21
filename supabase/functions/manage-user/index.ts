import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { atorHeaders } from "../_shared/ator.ts";

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

    // Check admin. Toda gravação deste cliente entra no log em nome de quem chamou.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: atorHeaders("manage_user", callerId) } });
    // Registro no log do que não nasce de tabela (login, convite, senha) e das tentativas que falharam.
    const registrar = async (p: Record<string, unknown>) => {
      const { error } = await adminClient.rpc("registrar_atividade", { p_tela: "Configurações › Usuários", ...p });
      if (error) console.error("registrar_atividade error:", error);
    };
    const rotuloDe = async (id: string) => {
      const { data } = await adminClient.from("profiles").select("name").eq("id", id).maybeSingle();
      const { data: u } = await adminClient.auth.admin.getUserById(id);
      return [data?.name, u?.user?.email].filter(Boolean).join(" · ") || id;
    };
    const falhou = async (acao: string, alvo: string | undefined, mensagem: string) =>
      registrar({ p_acao: acao, p_entidade: "usuario", p_entidade_id: alvo ?? null, p_rotulo: alvo ? await rotuloDe(alvo) : null, p_resultado: "erro", p_detalhe: mensagem });
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      await registrar({ p_acao: "acesso.negado", p_entidade: "usuario", p_resultado: "erro", p_detalhe: "Tentou gerenciar usuários sem ser administrador" });
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
      // Pessoa excluída não aparece mais: a conta só fica guardada, bloqueada, quando o histórico impede apagar.
      const users = (listData?.users ?? []).filter((u) => !(u.app_metadata as any)?.deleted_at).map((u) => ({
        id: u.id,
        email: u.email,
        name: (u.user_metadata as any)?.name ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        active: !!(u.user_metadata as any)?.password_set_at,
        disabled: !!(u as any).banned_until && new Date((u as any).banned_until) > new Date(),
        created_at: u.created_at,
        invited_by: (u.app_metadata as any)?.invited_by ?? null,
        team_view: !!(u.app_metadata as any)?.team_view,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));
      return jsonResponse({ users });
    }

    if (!action || !user_id) {
      return jsonResponse({ error: "action e user_id são obrigatórios" }, 400);
    }

    // === UPDATE ROLE ===
    if (action === "update_role") {
      // Qualquer papel do enum app_role vale; o banco recusa um papel inexistente.
      if (typeof role !== "string" || !/^[a-z_]+$/.test(role)) {
        return jsonResponse({ error: "Função inválida" }, 400);
      }
      if (user_id === callerId) {
        return jsonResponse({ error: "Você não pode alterar a sua própria função" }, 400);
      }
      // Cada pessoa tem uma única função: a nova substitui a atual numa só gravação. Se falhar, a pessoa mantém a atual.
      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id" });
      if (error) {
        console.error("update_role error:", error);
        await falhou("permissao.papel_alterado", user_id, error.message);
        return jsonResponse({ error: error.message }, 400);
      }
      await adminClient.from("user_roles").delete().eq("user_id", user_id).neq("role", role);
      return jsonResponse({ success: true });
    }

    // === ATIVAR / INATIVAR (bloqueia o login sem apagar nada) ===
    if (action === "set_active") {
      if (user_id === callerId) {
        return jsonResponse({ error: "Você não pode inativar a si mesmo" }, 400);
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: body.active === false ? "876000h" : "none",
      });
      if (error) {
        console.error("set_active error:", error);
        await falhou(body.active === false ? "permissao.acesso_bloqueado" : "permissao.acesso_liberado", user_id, error.message);
        return jsonResponse({ error: error.message }, 400);
      }
      await registrar({ p_acao: body.active === false ? "permissao.acesso_bloqueado" : "permissao.acesso_liberado", p_entidade: "usuario", p_entidade_id: user_id, p_rotulo: await rotuloDe(user_id) });
      return jsonResponse({ success: true });
    }

    // === UPDATE USER (nome, e-mail, senha) ===
    if (action === "update_user") {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 120) : undefined;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
      const password = typeof body.password === "string" && body.password ? body.password : undefined;
      if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return jsonResponse({ error: "Informe um e-mail válido" }, 400);
      }
      if (password !== undefined && password.length < 8) {
        return jsonResponse({ error: "A senha precisa ter pelo menos 8 caracteres" }, 400);
      }
      if (email && (await emailEmUso(adminClient, email, user_id))) {
        return jsonResponse({ error: "Já existe outro usuário com este e-mail" }, 409);
      }
      const changes: Record<string, unknown> = {};
      // Admin que usa a visão da equipe em vez do próprio ranking (só o servidor altera).
      if (typeof body.team_view === "boolean") changes.app_metadata = { team_view: body.team_view };
      if (email) { changes.email = email; changes.email_confirm = true; }
      if (password) { changes.password = password; changes.user_metadata = { password_set_at: new Date().toISOString() }; }
      if (Object.keys(changes).length) {
        const { data: antes } = await adminClient.auth.admin.getUserById(user_id);
        const { error } = await adminClient.auth.admin.updateUserById(user_id, changes);
        if (error) {
          console.error("update_user auth error:", error);
          await falhou("usuario.alterado", user_id, error.message);
          return jsonResponse({ error: error.message }, 400);
        }
        const rotulo = await rotuloDe(user_id);
        const base = { p_entidade: "usuario", p_entidade_id: user_id, p_rotulo: rotulo };
        if (email && email !== (antes?.user?.email ?? "").toLowerCase()) {
          await registrar({ ...base, p_acao: "usuario.email_alterado", p_dados: { antes: antes?.user?.email ?? null, depois: email } });
        }
        if (password) await registrar({ ...base, p_acao: "acesso.senha_trocada", p_detalhe: "Senha trocada pelo administrador" });
        if (typeof body.team_view === "boolean") await registrar({ ...base, p_acao: "usuario.visao_equipe_alterada", p_dados: { ver_como_equipe: body.team_view } });
      }
      if (name) {
        const { error } = await adminClient.from("profiles").update({ name }).eq("id", user_id);
        if (error) {
          await falhou("usuario.alterado", user_id, error.message);
          return jsonResponse({ error: error.message }, 400);
        }
      }
      return jsonResponse({ success: true });
    }

    // === RESEND INVITE ===
    if (action === "resend_invite") {
      const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(user_id);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Usuário não encontrado" }, 404);
      }

      if ((userData.user.user_metadata as any)?.password_set_at) {
        // Conta já ativa: envia link de redefinição de senha em vez de convite.
        const { error: resetError } = await userClient.auth.resetPasswordForEmail(
          userData.user.email!,
          { redirectTo: "https://painel.cupola.com.br/set-password" }
        );
        if (resetError) {
          console.error("resend_invite reset error:", resetError);
          await falhou("acesso.link_senha_enviado", user_id, resetError.message);
          return jsonResponse({ error: resetError.message }, 400);
        }
        await registrar({ p_acao: "acesso.link_senha_enviado", p_entidade: "usuario", p_entidade_id: user_id, p_rotulo: await rotuloDe(user_id) });
        return jsonResponse({ success: true, sent: "reset" });
      }

      const redirectTo = "https://painel.cupola.com.br/set-password";
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        userData.user.email!,
        { redirectTo }
      );
      if (inviteError) {
        console.error("resend_invite error:", inviteError);
        await falhou("acesso.convite_reenviado", user_id, inviteError.message);
        return jsonResponse({ error: inviteError.message }, 400);
      }
      await registrar({ p_acao: "acesso.convite_reenviado", p_entidade: "usuario", p_entidade_id: user_id, p_rotulo: await rotuloDe(user_id) });
      return jsonResponse({ success: true, sent: "invite" });
    }

    // === DELETE USER ===
    if (action === "delete_user") {
      if (user_id === callerId) {
        return jsonResponse({ error: "Você não pode excluir a si mesmo" }, 400);
      }

      // Excluir é para sempre e lógico: a pessoa perde o acesso na hora, mas continua no histórico.
      const rotulo = await rotuloDe(user_id);
      // 1) Bloqueia o login antes de tudo: se isso falhar, nada muda e o painel avisa.
      const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: "876000h",
        app_metadata: { deleted_at: new Date().toISOString() },
      });
      if (banError) {
        console.error("delete_user ban error:", banError);
        await falhou("usuario.excluido", user_id, banError.message);
        return jsonResponse({ error: banError.message }, 400);
      }
      // 2) Tira função, eventos e cupons: sem nada disso, nenhuma tela ou dado fica acessível. Cada remoção entra no log.
      for (const tabela of ["user_roles", "event_users", "user_event_scope", "team_coupons"] as const) {
        const { error } = await adminClient.from(tabela).delete().eq("user_id", user_id);
        if (error) console.error(`delete_user ${tabela} error:`, error);
      }
      await adminClient.from("coupon_people").update({ user_id: null }).eq("user_id", user_id);
      // 3) O perfil fica guardado com a data da exclusão: o log grava "usuario.excluido" com tudo o que existia.
      const { data: marcado } = await adminClient.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", user_id).select("id");
      if (!marcado?.length) {
        await registrar({ p_acao: "usuario.excluido", p_entidade: "profiles", p_entidade_id: user_id, p_rotulo: rotulo, p_detalhe: "Conta sem perfil no painel" });
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
