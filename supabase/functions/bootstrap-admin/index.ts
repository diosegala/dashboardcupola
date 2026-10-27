import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL = "emillyn.machado@cupola.com.br";

Deno.serve(async (req) => {
  try {
    const { password } = await req.json();
    if (typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "invalid password" }), { status: 400 });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === EMAIL);
    let userId: string;
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) throw error;
      userId = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, user_metadata: { name: "Emillyn Machado" } });
      if (error) throw error;
      userId = data.user!.id;
    }
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (rErr) throw rErr;
    return new Response(JSON.stringify({ success: true, existed: !!existing }));
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500 });
  }
});
