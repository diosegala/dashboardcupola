import { describe, expect, it } from "vitest";
import { vendasDoExtrato, grupoDe } from "@/lib/salesStatement";

const pedido = (id: string, data: string, status = "PENDING") => ({ order_data: { id, order_status: status, order_date: data, order_total_sale_price: 1000 } });
const agora = new Date("2026-11-24T12:00:00-03:00").getTime();

describe("aguardando pagamento por mais de 7 dias", () => {
  it("com 8 dias sem aprovar vira cancelado", () => {
    const [v] = vendasDoExtrato([], [], [pedido("A", "2026-11-16 11:00:00")], [], agora);
    expect(v.status).toBe("Cancelado");
    expect(grupoDe(v)).toBe("canceladas");
  });
  it("com 6 dias segue aguardando", () => {
    const [v] = vendasDoExtrato([], [], [pedido("B", "2026-11-18 12:00:00")], [], agora);
    expect(grupoDe(v)).toBe("aguardando");
  });
  it("pedido cancelado na Sympla aparece em canceladas", () => {
    const [v] = vendasDoExtrato([], [], [pedido("C", "2026-11-23 12:00:00", "CANCELLED")], [], agora);
    expect(grupoDe(v)).toBe("canceladas");
  });
});
