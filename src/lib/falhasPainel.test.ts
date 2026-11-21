import { describe, expect, it } from "vitest";
import { analisarFalha } from "./falhasPainel";

const B = "https://x.supabase.co";
describe("ouvinte de falhas", () => {
  it("gravação recusada vira falha de gravação", () => {
    expect(analisarFalha(`${B}/rest/v1/goals?id=eq.1`, "PATCH", 403, B)).toEqual({ acao: "falha.gravacao", entidade: "goals" });
  });
  it("função do servidor com erro vira falha de função", () => {
    expect(analisarFalha(`${B}/functions/v1/manage-user`, "POST", 400, B)).toEqual({ acao: "falha.funcao", entidade: "manage-user" });
  });
  it("leitura com erro e sucesso não geram registro", () => {
    expect(analisarFalha(`${B}/rest/v1/goals`, "GET", 500, B)).toBeNull();
    expect(analisarFalha(`${B}/rest/v1/goals`, "POST", 201, B)).toBeNull();
  });
  it("não registra a falha do próprio registro (sem laço)", () => {
    expect(analisarFalha(`${B}/rest/v1/rpc/registrar_atividade`, "POST", 500, B)).toBeNull();
  });
});
