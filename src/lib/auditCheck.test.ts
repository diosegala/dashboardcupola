import { describe, expect, it } from "vitest";
import { tabelasSemAuditoria } from "./auditCheck";

describe("checagem de auditoria nas migrações", () => {
  it("acusa tabela nova sem auditoria_ligar", () => {
    expect(tabelasSemAuditoria("CREATE TABLE public.page_permissions (id uuid);")).toEqual(["page_permissions"]);
  });
  it("aceita tabela com auditoria_ligar na mesma migração", () => {
    expect(tabelasSemAuditoria("create table if not exists public.notas (id uuid);\nSELECT public.auditoria_ligar('notas');")).toEqual([]);
  });
  it("ignora tabela só citada em comentário", () => {
    expect(tabelasSemAuditoria("-- CREATE TABLE public.velha (id int);\nselect 1;")).toEqual([]);
  });
});
