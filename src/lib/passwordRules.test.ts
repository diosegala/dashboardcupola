import { describe, it, expect } from "vitest";
import { criteriosSenha, precisaCriarSenha } from "./passwordRules";

const ok = (s: string, c = s) => criteriosSenha(s, c).every((x) => x.ok);

describe("criteriosSenha", () => {
  it("exige 8 caracteres", () => expect(ok("Abc1234")).toBe(false));
  it("exige maiúscula", () => expect(ok("abcd1234")).toBe(false));
  it("exige número", () => expect(ok("Abcdefgh")).toBe(false));
  it("exige senhas iguais", () => expect(ok("Abcd1234", "Abcd1235")).toBe(false));
  it("aceita senha que cumpre tudo", () => expect(ok("Abcd1234")).toBe(true));
});

describe("precisaCriarSenha", () => {
  it("bloqueia quem não criou senha", () => expect(precisaCriarSenha({ user_metadata: {} })).toBe(true));
  it("libera quem criou senha", () => expect(precisaCriarSenha({ user_metadata: { password_set_at: "x" } })).toBe(false));
});
