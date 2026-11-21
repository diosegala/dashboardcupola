import { describe, expect, it } from "vitest";
import { comparacao, descreverAcao, filtroParaBanco, filtrosDaUrl, gerarCsv, intervaloDoPeriodo, quem, urlDosFiltros, type LogLinha } from "./activityLog";

describe("período em Brasília", () => {
  // 21/11/2026 01:00 UTC ainda é 20/11 em Brasília.
  const agora = new Date("2026-11-21T01:00:00Z");
  it("hoje começa à meia-noite de Brasília", () => {
    expect(intervaloDoPeriodo("hoje", agora)).toEqual({ de: "2026-11-20T00:00:00-03:00" });
  });
  it("7 dias inclui hoje e os 6 anteriores", () => {
    expect(intervaloDoPeriodo("7d", agora)).toEqual({ de: "2026-11-14T00:00:00-03:00" });
  });
  it("personalizado vai até o fim do último dia", () => {
    expect(intervaloDoPeriodo("personalizado", agora, "2026-11-01", "2026-11-05")).toEqual({ de: "2026-11-01T00:00:00-03:00", ate: "2026-11-06T00:00:00-03:00" });
  });
});

describe("filtros no endereço", () => {
  it("o link enviado a outro admin abre os mesmos filtros", () => {
    const f = filtrosDaUrl(new URLSearchParams("periodo=30d&pessoa=abc&categoria=permissao"));
    expect(urlDosFiltros(f).toString()).toBe("periodo=30d&pessoa=abc&categoria=permissao");
    expect(filtroParaBanco(f, new Date("2026-11-21T15:00:00Z"))).toEqual({ de: "2026-10-23T00:00:00-03:00", pessoa: "abc", categoria: "permissao" });
  });
  it("sem período no endereço, usa 7 dias", () => {
    expect(filtrosDaUrl(new URLSearchParams("")).periodo).toBe("7d");
  });
});

describe("ação e quem", () => {
  it("exclusão de usuário é vermelha (excluiu)", () => {
    expect(descreverAcao("usuario.excluido")).toEqual({ texto: "Excluiu usuário", tom: "excluiu" });
  });
  it("ação genérica usa o verbo do sufixo", () => {
    expect(descreverAcao("meta.criado")).toEqual({ texto: "Criou meta", tom: "criou" });
  });
  it("automação aparece com o nome do processo", () => {
    expect(quem({ actor_id: null, actor_nome: null, actor_email: null, actor_papel: null, actor_processo: "sync_sympla", actor_origem: "integracao", acao: "ingressos.importado" }))
      .toEqual({ nome: "Sincronização Sympla", detalhe: "Automação", automacao: true });
  });
  it("pessoa excluída continua com o nome gravado na linha", () => {
    expect(quem({ actor_id: "u1", actor_nome: "Ana Souza", actor_email: "ana@x.com", actor_papel: "viewer", actor_processo: null, actor_origem: "painel", acao: "meta.alterado" }).nome).toBe("Ana Souza");
  });
});

describe("antes e depois", () => {
  it("na edição mostra só os campos alterados", () => {
    const linhas = comparacao({ acao: "permissao.papel.alterado", campos_alterados: ["role"], dados_antes: { id: "1", role: "viewer", user_id: "u" }, dados_depois: { id: "1", role: "admin", user_id: "u" } });
    expect(linhas).toEqual([{ campo: "role", rotulo: "Função", antes: "viewer", depois: "admin", oculto: false }]);
  });
  it("campo sensível aparece como valor oculto", () => {
    const [l] = comparacao({ acao: "integracao.credencial_trocada", campos_alterados: ["credentials"], dados_antes: { credentials: "••••" }, dados_depois: { credentials: "••••" } });
    expect(l.oculto).toBe(true);
    expect(l.depois).toBe("valor oculto");
  });
});

describe("CSV", () => {
  it("separa por ponto e vírgula e protege aspas", () => {
    const l = { id: 1, ocorrido_em: "2026-11-21T19:00:00Z", acao: "meta.alterado", categoria: "operacao", entidade: "goals", entidade_id: "1", entidade_rotulo: 'Meta "A"; lote 1', tela: "Metas", event_id: null, event_nome: null, actor_id: "u", actor_nome: "Ana", actor_email: "ana@x.com", actor_papel: "admin", actor_origem: "painel", actor_processo: null, actor_removido: false, ip: null, user_agent: null, campos_alterados: ["target_value"], qtd_linhas: null, resultado: "sucesso", detalhe_erro: null } as LogLinha;
    const [, linha] = gerarCsv([l]).replace("\uFEFF", "").split("\r\n");
    expect(linha).toBe('21/11/2026, 16:00:00;Ana;ana@x.com;Administrador;Painel;;Alterou meta;Operação;Metas;"Meta ""A""; lote 1";;Valor da meta;;Sucesso;;');
  });
});
