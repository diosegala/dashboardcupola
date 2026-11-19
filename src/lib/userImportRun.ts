// Execução da importação: aplica o plano de cada linha usando os mesmos caminhos do cadastro manual
// (convite pelo invite-user, acesso a eventos e fichas de cupom). Pessoa por pessoa: se uma falhar, as outras seguem,
// e subir a planilha de novo completa o que faltou (a conferência sempre compara com a base atual).
import { supabase } from "@/integrations/supabase/client";
import { eventAccessActions } from "@/lib/eventAccess";
import type { FichaBase, Resultado } from "@/lib/userImport";

export interface Falha { linha: number; nome: string; motivo: string }

async function invocar(fn: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

async function aplicarCupons(userId: string, nome: string, r: Resultado, fichas: FichaBase[]) {
  const p = r.plano!;
  const tabela = () => supabase.from("coupon_people" as any);
  // 1) Transferência: tira o código do dono atual antes (a trava do banco não aceita o mesmo código em duas fichas).
  for (const t of p.transferencias) {
    const origem = fichas.find((f) => f.id === t.fichaOrigem);
    if (!origem) continue;
    const restantes = origem.codes.filter((c) => c.trim().toUpperCase() !== t.codigo);
    const { error } = await tabela().update({ codes: restantes }).eq("id", origem.id);
    if (error) throw error;
    origem.codes = restantes;
  }
  // 2) Fichas sem dono que já tinham o código passam a ser desta pessoa.
  if (p.ligarFichas.length) {
    const { error } = await tabela().update({ user_id: userId, link_manual: true }).in("id", p.ligarFichas);
    if (error) throw error;
  }
  // 3) Códigos novos e transferidos entram na ficha da pessoa (ou numa ficha nova).
  const entrar = [...p.novosCodigos, ...p.transferencias.map((t) => t.codigo)];
  if (!entrar.length) return;
  const { data: atuais, error: e1 } = await tabela().select("id, codes").eq("user_id", userId).order("created_at").limit(1);
  if (e1) throw e1;
  const ficha = (atuais as any[] | null)?.[0];
  if (ficha) {
    const codes = Array.from(new Set([...(ficha.codes ?? []), ...entrar]));
    const { error } = await tabela().update({ codes }).eq("id", ficha.id);
    if (error) throw error;
  } else {
    const { error } = await tabela().insert({ name: nome, codes: entrar, seller_names: [], outside_ranking: false, user_id: userId, link_manual: true });
    if (error) throw error;
  }
}

export async function executarImportacao(
  prontas: Resultado[],
  eventId: string,
  fichas: FichaBase[],
  aoAvancar: (feitas: number) => void,
): Promise<{ falhas: Falha[]; feitas: number }> {
  const falhas: Falha[] = [];
  let feitas = 0;
  for (const r of prontas) {
    const p = r.plano!;
    try {
      let userId = p.userId;
      if (p.convidar) {
        const d = await invocar("invite-user", { email: p.convidar.email, role: p.convidar.role, name: p.convidar.name });
        userId = d?.user_id;
        if (!userId) throw new Error("O convite não devolveu a conta criada");
      }
      if (p.reativar) await invocar("manage-user", { action: "set_active", user_id: userId, active: true });
      if (p.liberarEvento) await eventAccessActions.grant([userId!], eventId);
      await aplicarCupons(userId!, r.nome, r, fichas);
      feitas++;
    } catch (err) {
      falhas.push({ linha: r.linha, nome: r.nome, motivo: (err as Error).message || "Erro desconhecido" });
    }
    aoAvancar(feitas + falhas.length);
  }
  return { falhas, feitas };
}
