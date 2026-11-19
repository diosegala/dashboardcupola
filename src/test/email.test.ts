import { describe, expect, it } from "vitest";
import { erroEmail, limparEmail } from "@/lib/email";

describe("e-mail", () => {
  it("tira espaços das pontas e aceita", () => {
    expect(limparEmail("  Nome@Empresa.com.br ")).toBe("nome@empresa.com.br");
    expect(erroEmail("  nome@empresa.com.br  ")).toBeNull();
  });
  it.each(["a@b.co", "nome.sobrenome+tag@sub.empresa.com.br", "x_y-z@dominio-1.io"])("aceita %s", (e) => {
    expect(erroEmail(e)).toBeNull();
  });
  it.each([
    "nome @empresa.com", "nomeempresa.com", "a@@b.com", "a@b@c.com", "@empresa.com", "nome@",
    "nome@empresa", ".nome@empresa.com", "nome.@empresa.com", "no..me@empresa.com", "nome@empresa..com",
    "nome@.empresa.com", "nome@empresa.com.", "nome@-empresa.com", "nome@empresa-.com", "nome@empresa.c",
    "nome@empresa.c0m", "nó@empresa.com", "nome@empre$a.com", "nome(1)@empresa.com", "",
  ])("recusa %s", (e) => {
    expect(erroEmail(e)).not.toBeNull();
  });
});
