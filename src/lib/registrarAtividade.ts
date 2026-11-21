import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { telaDaRota } from "./activityLog";

// Registros que não nascem de tabela (entrar, sair, trocar senha, acesso negado). Quem agiu é decidido pelo banco.
// Nunca trava a tela: se o registro falhar, a ação da pessoa segue.
export async function registrarAtividade(
  acao: string,
  extra: { p_entidade?: string; p_entidade_id?: string; p_rotulo?: string; p_resultado?: "sucesso" | "erro"; p_detalhe?: string; p_dados?: Json; p_email?: string } = {},
) {
  try {
    const { error } = await supabase.rpc("registrar_atividade", { p_acao: acao, p_tela: telaDaRota(window.location.pathname), ...extra });
    if (error) console.warn("[log] não registrado:", error.message);
  } catch (err) {
    console.warn("[log] não registrado:", err);
  }
}
