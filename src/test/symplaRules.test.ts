import { describe, expect, it } from "vitest";
import { invoiceCompany } from "../../supabase/functions/_shared/sympla-rules";

// A sincronização da Sympla só grava participantes reais: não há mais estimativa de ingressos sem participante.
describe("regras da Sympla", () => {
  it("empresa só quando a nota sai em CNPJ", () => {
    expect(invoiceCompany({ invoice_info: { doc_type: "CNPJ", client_name: "Imobiliária X" } })).toBe("Imobiliária X");
    expect(invoiceCompany({ invoice_info: { doc_type: "CPF", client_name: "Fulana" } })).toBeNull();
  });
});
