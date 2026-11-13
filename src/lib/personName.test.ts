import { describe, it, expect } from "vitest";
import { firstName, formatPersonName, nameFromEmail } from "./personName";

describe("formatPersonName", () => {
  it.each([
    ["EMILLYN MACHADO", "Emillyn Machado"],
    ["emillyn machado", "Emillyn Machado"],
    ["eMiLlYn mAcHaDo", "Emillyn Machado"],
    ["SUELLEN", "Suellen"],
    ["joão pedro", "João Pedro"],
    ["  ÉRICA   rocha ", "Érica Rocha"],
  ])("%s → %s", (entrada, saida) => expect(formatPersonName(entrada)).toBe(saida));
});

describe("primeiro nome", () => {
  it("usa o nome cadastrado", () => expect(firstName("suellen de cassia moreira")).toBe("Suellen"));
  it("nome guardado como e-mail", () => expect(firstName("alice.santos@cupola.com.br")).toBe("Alice"));
  it("sem nome usa o e-mail", () => expect(firstName(null, "renata.maciel@cupola.com.br")).toBe("Renata"));
  it("e-mail vira nome completo", () => expect(nameFromEmail("aline.pavezi@cupola.com.br")).toBe("Aline Pavezi"));
});
