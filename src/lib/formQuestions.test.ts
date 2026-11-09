import { describe, expect, it } from "vitest";
import { themeCharts } from "./formQuestions";

describe("cargo", () => {
  it("junta CEO / Dono com Dono / Sócio e Outro com Outros", () => {
    const [cargo] = themeCharts([
      { question: "Cargo", answer: "CEO / Dono", total: 425 },
      { question: "Cargo", answer: "Dono / Sócio", total: 26 },
      { question: "Cargo", answer: "Gerente", total: 264 },
      { question: "Cargo", answer: "Outros", total: 122 },
      { question: "Cargo", answer: "Outro", total: 5 },
    ]);
    expect(cargo.items).toEqual([
      { label: "Dono / Sócio / CEO", value: 451 },
      { label: "Gerente", value: 264 },
      { label: "Outros", value: 127 },
    ]);
  });
});
