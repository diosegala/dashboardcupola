import { describe, expect, it } from "vitest";
import { buildTeamRanking } from "@/components/dashboard/TeamRanking";
import { diaBrasilia } from "@/lib/batchCalendar";

describe("ranking da equipe segue o calendário de lotes", () => {
  it("o lote atual é o do calendário, mesmo sem venda nele ainda", () => {
    const hoje = diaBrasilia();
    const ontem = diaBrasilia(new Date(Date.now() - 86400000));
    const venda = { quantity: 2, total_price: 100, coupon_code: "KARINY5", ticket_type: "Lote 0 | Ingresso Padrão", sold_at: `${ontem}T15:00:00Z`, status: "approved" } as never;
    const r = buildTeamRanking([venda], [], [
      { name: "Lote 0", start_date: "2020-01-01", end_date: ontem },
      { name: "Lote 1", start_date: hoje, end_date: "2099-12-31" },
    ]);
    expect(r.loteAtual).toBe("Lote 1");
    expect(r.lotes.map((l) => l.lote)).toEqual(["Lote 0", "Lote 1"]);
    expect(r.campeoes.map((c) => c.lotes)).toEqual([["Lote 0"]]);
  });
});
