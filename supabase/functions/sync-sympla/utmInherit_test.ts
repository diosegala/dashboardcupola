import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { utmHerdada } from "./utmInherit.ts";

const u = (s: string, c = "x") => ({ utm_source: s, utm_medium: "email", utm_campaign: "c", utm_content: c });
const pago = { id: "35EA3C1N555", buyer_email: "A@x.com", order_date: "2026-11-24 10:10:00", utm: {} };

Deno.test("herda a UTM da tentativa mais recente em até 72h", () => {
  const todos = [pago,
    { id: "1", buyer_email: "a@x.com", order_date: "2026-11-24 09:50:00", order_status: "C", utm: u("rd", "antigo") },
    { id: "2", buyer_email: "a@x.com", order_date: "2026-11-24 09:55:00", order_status: "P", utm: u("rd", "lembrete") }];
  assertEquals(utmHerdada(pago, todos)?.utm_content, "lembrete");
});
Deno.test("não herda depois de 72 horas", () => {
  const todos = [pago, { id: "1", buyer_email: "a@x.com", order_date: "2026-11-21 10:09:00", utm: u("rd") }];
  assertEquals(utmHerdada(pago, todos), null);
});
Deno.test("pedido com UTM não muda", () => {
  const p = { ...pago, utm: u("meta") };
  assertEquals(utmHerdada(p, [p, { id: "1", buyer_email: "a@x.com", order_date: "2026-11-24 09:55:00", utm: u("rd") }]), null);
});
Deno.test("outro e-mail não herda", () => {
  assertEquals(utmHerdada(pago, [{ id: "1", buyer_email: "b@x.com", order_date: "2026-11-24 09:55:00", utm: u("rd") }]), null);
});
