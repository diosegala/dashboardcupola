import { describe, expect, it } from "vitest";
import { countBy, utmLabel } from "@/components/dashboard/CommercialSegments";

describe("origem da venda (UTM)", () => {
  it("vazio ou só espaços não vira origem", () => {
    expect(utmLabel(null)).toBeNull();
    expect(utmLabel("   ")).toBeNull();
  });

  it("maiúsculas, minúsculas e espaços sobrando viram o mesmo canal", () => {
    expect(utmLabel("Instagram")).toBe("Instagram");
    expect(utmLabel(" instagram ")).toBe("Instagram");
    expect(utmLabel("NEWSLETTER")).toBe("Newsletter");
    expect(utmLabel("rd  station")).toBe("Rd station");
  });

  it("ig e instagram são o mesmo canal", () => {
    expect(utmLabel("ig")).toBe("Instagram");
    expect(utmLabel("IG")).toBe("Instagram");
  });

  it("origem desconhecida aparece como veio, só com a primeira letra maiúscula", () => {
    expect(utmLabel("indicação")).toBe("Indicação");
  });

  it("ainda converte UTM gravado como códigos de letra", () => {
    expect(utmLabel("(105,103)")).toBe("Instagram");
  });

  it("a contagem junta as variações do mesmo canal", () => {
    const tickets = [{ utm_source: "ig", quantity: 2 }, { utm_source: "Instagram", quantity: 1 }, { utm_source: "email", quantity: 4 }, { utm_source: null, quantity: 9 }] as any[];
    expect(countBy(tickets, (t) => utmLabel(t.utm_source))).toEqual([
      { label: "Email", value: 4 },
      { label: "Instagram", value: 3 },
    ]);
  });
});
