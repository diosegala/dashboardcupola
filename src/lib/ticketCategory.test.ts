import { describe, expect, it } from "vitest";
import { ticketCategory } from "./ticketCategory";

const base = { status: "APPROVED", ticket_type: "Lote 1 | Ingresso Padrão", unit_price: 889, coupon_code: null as string | null };

describe("ticketCategory", () => {
  it("cupom 100% é cortesia mesmo com valor", () => expect(ticketCategory({ ...base, coupon_code: "100.00% - GANHADOR_X" })).toBe("cortesias"));
  it("credencial com valor não conta como pago", () => expect(ticketCategory({ ...base, ticket_type: "Credencial Expositor" })).toBe("credenciais"));
  it("cupom de desconto parcial conta como pago com desconto", () => expect(ticketCategory({ ...base, coupon_code: "10.00% - ISABELLESA10" })).toBe("desconto"));
  it("sem cupom e com valor é pago", () => expect(ticketCategory(base)).toBe("pagos"));
  it("não aprovado é pendente", () => expect(ticketCategory({ ...base, status: "PENDING" })).toBe("pendentes"));
});
