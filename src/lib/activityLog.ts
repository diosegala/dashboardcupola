// Regras da tela Logs: textos, filtros no endereço, período em Brasília, comparação antes/depois e CSV.
// Tudo aqui é puro (sem rede) e testado; a tela só lê a tabela de logs, nunca a lista de usuários.

export type Categoria = "dados" | "acesso" | "permissao" | "evento" | "integracao" | "operacao";
export type Tom = "criou" | "alterou" | "excluiu" | "acessou";

export interface LogLinha {
  id: number;
  ocorrido_em: string;
  acao: string;
  categoria: string;
  entidade: string;
  entidade_id: string | null;
  entidade_rotulo: string | null;
  tela: string | null;
  event_id: string | null;
  event_nome: string | null;
  actor_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
  actor_papel: string | null;
  actor_origem: string;
  actor_processo: string | null;
  actor_removido: boolean;
  ip: unknown;
  user_agent: string | null;
  dados_antes?: unknown;
  dados_depois?: unknown;
  campos_alterados: string[];
  qtd_linhas: number | null;
  resultado: string;
  detalhe_erro: string | null;
}

export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "permissao", label: "Permissão" },
  { value: "acesso", label: "Acesso" },
  { value: "dados", label: "Dados" },
  { value: "evento", label: "Evento" },
  { value: "integracao", label: "Integração" },
  { value: "operacao", label: "Operação" },
];

export const PAPEIS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "viewer", label: "Visualizador" },
  { value: "seller", label: "Ranking" },
  { value: "automacao", label: "Automação" },
];

export const ORIGENS: Record<string, string> = { painel: "Painel", integracao: "Integração", sistema: "Sistema" };

const PROCESSOS: Record<string, string> = {
  sync_sympla: "Sincronização Sympla",
  sync_meta: "Sincronização Meta Ads",
  sync_google_ads: "Sincronização Google Ads",
  sync_google_analytics: "Sincronização Google Analytics",
  sync_rd_station: "Sincronização RD Station",
  sync_pipedrive: "Sincronização Pipedrive",
  pipedrive_webhook: "Aviso automático do Pipedrive",
  list_crm_options: "Consulta ao Pipedrive",
  manage_user: "Gestão de usuários",
  invite_user: "Convite de usuários",
  login_e_convites: "Sistema de login",
  pg_cron: "Tarefa agendada",
  sql_direto: "Banco de dados (direto)",
  servidor_sem_identificacao: "Servidor sem identificação",
};

export function nomeProcesso(p: string | null | undefined): string {
  if (!p) return "Sistema";
  return PROCESSOS[p] ?? p.replace(/_/g, " ");
}

export function nomePapel(p: string | null | undefined): string {
  if (!p) return "";
  return p.split(",").map((x) => PAPEIS.find((r) => r.value === x)?.label ?? x).join(", ");
}

export function nomeCategoria(c: string): string {
  return CATEGORIAS.find((x) => x.value === c)?.label ?? c;
}

// Verbos claros por ação. A cor é só apoio: o texto sempre explica.
const ACOES: Record<string, { texto: string; tom: Tom }> = {
  "acesso.login": { texto: "Entrou no painel", tom: "acessou" },
  "acesso.logout": { texto: "Saiu do painel", tom: "acessou" },
  "acesso.login_falhou": { texto: "Falhou ao entrar", tom: "acessou" },
  "acesso.senha_trocada": { texto: "Trocou a senha", tom: "alterou" },
  "acesso.convite_enviado": { texto: "Enviou convite", tom: "criou" },
  "acesso.convite_reenviado": { texto: "Reenviou convite", tom: "acessou" },
  "acesso.convite_aceito": { texto: "Aceitou o convite", tom: "criou" },
  "acesso.link_senha_enviado": { texto: "Enviou link de troca de senha", tom: "acessou" },
  "acesso.negado": { texto: "Tentou abrir área restrita", tom: "acessou" },
  "usuario.criado": { texto: "Criou usuário", tom: "criou" },
  "usuario.alterado": { texto: "Alterou usuário", tom: "alterou" },
  "usuario.excluido": { texto: "Excluiu usuário", tom: "excluiu" },
  "usuario.email_alterado": { texto: "Trocou o e-mail", tom: "alterou" },
  "usuario.visao_equipe_alterada": { texto: "Alterou o \"Ver como a equipe\"", tom: "alterou" },
  "permissao.papel.criado": { texto: "Definiu a função", tom: "criou" },
  "permissao.papel.alterado": { texto: "Mudou a função", tom: "alterou" },
  "permissao.papel.excluido": { texto: "Removeu a função", tom: "excluiu" },
  "permissao.papel_alterado": { texto: "Mudou a função", tom: "alterou" },
  "permissao.papel_definido": { texto: "Definiu a função", tom: "criou" },
  "permissao.evento.criado": { texto: "Liberou um evento", tom: "criou" },
  "permissao.evento.excluido": { texto: "Retirou um evento", tom: "excluiu" },
  "permissao.escopo.criado": { texto: "Definiu o acesso a eventos", tom: "criou" },
  "permissao.escopo.alterado": { texto: "Mudou o acesso a eventos", tom: "alterou" },
  "permissao.escopo.excluido": { texto: "Retirou o acesso a eventos", tom: "excluiu" },
  "permissao.acesso_bloqueado": { texto: "Bloqueou o acesso", tom: "excluiu" },
  "permissao.acesso_liberado": { texto: "Liberou o acesso", tom: "criou" },
  "integracao.falhou": { texto: "Sincronização falhou", tom: "alterou" },
  "integracao.credencial_trocada": { texto: "Trocou credencial", tom: "alterou" },
  "integracao.conectada": { texto: "Conectou integração", tom: "criou" },
  "integracao.desconectada": { texto: "Desconectou integração", tom: "excluiu" },
  "integracao.sincronizacao_manual": { texto: "Pediu sincronização", tom: "acessou" },
  "evento.sympla_trocado": { texto: "Trocou o ID da Sympla", tom: "alterou" },
  "evento.publicado": { texto: "Publicou o evento", tom: "criou" },
  "evento.arquivado": { texto: "Arquivou o evento", tom: "excluiu" },
  "evento.config_herdada": { texto: "Herdou a configuração da edição anterior", tom: "criou" },
  "log.exportado": { texto: "Exportou o log", tom: "acessou" },
  "dados.exportado": { texto: "Exportou dados", tom: "acessou" },
  "falha.gravacao": { texto: "Tentou gravar e falhou", tom: "alterou" },
  "falha.funcao": { texto: "Ação no servidor falhou", tom: "alterou" },
};

const SUJEITOS: Record<string, string> = {
  evento: "evento", lote: "lote", "evento.integracao": "integração do evento", importacao: "importação de pessoas",
  integracao: "integração", meta: "meta", cupom: "cupom", "cupom.antigo": "cupom antigo",
  "patrocinio.config": "configuração de patrocínio", "patrocinio.pendencia": "pendência de patrocínio",
  "config.email_venda": "ligação de e-mail a venda", "config.segredo": "segredo do sistema", "config.auditoria": "cadastro da auditoria",
};

const VERBOS: Record<string, { texto: string; tom: Tom }> = {
  criado: { texto: "Criou", tom: "criou" },
  alterado: { texto: "Alterou", tom: "alterou" },
  excluido: { texto: "Excluiu", tom: "excluiu" },
  importado: { texto: "Importou", tom: "criou" },
  atualizado: { texto: "Atualizou", tom: "alterou" },
  removido: { texto: "Removeu", tom: "excluiu" },
  falhou: { texto: "Falhou", tom: "alterou" },
};

export function descreverAcao(acao: string): { texto: string; tom: Tom } {
  if (ACOES[acao]) return ACOES[acao];
  const i = acao.lastIndexOf(".");
  const prefixo = acao.slice(0, i);
  const verbo = VERBOS[acao.slice(i + 1)];
  if (!verbo) return { texto: acao, tom: "acessou" };
  const sujeito = SUJEITOS[prefixo];
  return { texto: sujeito ? `${verbo.texto} ${sujeito}` : verbo.texto, tom: verbo.tom };
}

// Quem agiu: sempre do retrato gravado na própria linha.
export function quem(l: Pick<LogLinha, "actor_nome" | "actor_email" | "actor_papel" | "actor_processo" | "actor_origem" | "actor_id" | "acao">) {
  if (l.actor_id || l.actor_nome) {
    return { nome: l.actor_nome || l.actor_email || "Pessoa sem nome", detalhe: nomePapel(l.actor_papel) || (l.actor_processo ? nomeProcesso(l.actor_processo) : ""), automacao: false };
  }
  if (l.actor_email) return { nome: l.actor_email, detalhe: "não confirmado", automacao: false };
  return { nome: nomeProcesso(l.actor_processo), detalhe: "Automação", automacao: true };
}

export function resumoLinha(l: Pick<LogLinha, "acao" | "campos_alterados" | "qtd_linhas" | "resultado" | "detalhe_erro">): string {
  if (l.qtd_linhas != null && !l.acao.startsWith("log.")) return `${l.qtd_linhas} ${l.qtd_linhas === 1 ? "linha" : "linhas"}`;
  const n = l.campos_alterados?.length ?? 0;
  if (n) return `${n} ${n === 1 ? "campo alterado" : "campos alterados"}`;
  if (l.resultado === "erro" && l.detalhe_erro) return l.detalhe_erro;
  // Criou/excluiu já está dito na Ação; repetir aqui só polui a leitura.
  return "";
}

// ---------- Período, sempre no horário de Brasília (UTC-3, sem horário de verão) ----------
export type Periodo = "hoje" | "7d" | "30d" | "tudo" | "personalizado";
export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "tudo", label: "Todo o período" },
  { value: "personalizado", label: "Personalizado" },
];

export function diaBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const inicioDoDia = (dia: string) => `${dia}T00:00:00-03:00`;

export function intervaloDoPeriodo(p: Periodo, agora: Date, de?: string | null, ate?: string | null): { de?: string; ate?: string } {
  const hoje = diaBrasilia(agora);
  if (p === "hoje") return { de: inicioDoDia(hoje) };
  if (p === "7d") return { de: inicioDoDia(somarDias(hoje, -6)) };
  if (p === "30d") return { de: inicioDoDia(somarDias(hoje, -29)) };
  if (p === "personalizado") {
    return {
      ...(de && /^\d{4}-\d{2}-\d{2}$/.test(de) ? { de: inicioDoDia(de) } : {}),
      ...(ate && /^\d{4}-\d{2}-\d{2}$/.test(ate) ? { ate: inicioDoDia(somarDias(ate, 1)) } : {}),
    };
  }
  return {};
}

// ---------- Filtros no endereço da página ----------
export const CHAVES_FILTRO = ["pessoa", "papel", "categoria", "tela", "evento", "resultado", "busca", "entidade", "entidade_id"] as const;
export type ChaveFiltro = (typeof CHAVES_FILTRO)[number];
export interface Filtros {
  periodo: Periodo;
  de?: string;
  ate?: string;
  valores: Partial<Record<ChaveFiltro, string>>;
}

export function filtrosDaUrl(params: URLSearchParams): Filtros {
  const p = params.get("periodo") as Periodo | null;
  const valores: Filtros["valores"] = {};
  for (const k of CHAVES_FILTRO) {
    const v = params.get(k)?.trim();
    if (v) valores[k] = v.slice(0, 200);
  }
  return {
    periodo: PERIODOS.some((x) => x.value === p) ? (p as Periodo) : "7d",
    de: params.get("de") ?? undefined,
    ate: params.get("ate") ?? undefined,
    valores,
  };
}

export function urlDosFiltros(f: Filtros): URLSearchParams {
  const out = new URLSearchParams();
  if (f.periodo !== "7d") out.set("periodo", f.periodo);
  if (f.periodo === "personalizado") {
    if (f.de) out.set("de", f.de);
    if (f.ate) out.set("ate", f.ate);
  }
  for (const k of CHAVES_FILTRO) if (f.valores[k]) out.set(k, f.valores[k]!);
  return out;
}

// O que vai para o banco: o mesmo critério serve para lista, números e exportação.
export function filtroParaBanco(f: Filtros, agora: Date): Record<string, string> {
  return { ...intervaloDoPeriodo(f.periodo, agora, f.de, f.ate), ...(f.valores as Record<string, string>) };
}

// ---------- Antes e depois ----------
const CAMPOS: Record<string, string> = {
  name: "Nome", email: "E-mail", role: "Função", event_id: "Evento", user_id: "Pessoa", all_events: "Todos os eventos",
  start_date: "Início", end_date: "Término", sympla_event_id: "ID da Sympla", slug: "Endereço curto", previous_event_slug: "Edição anterior",
  paying_goal: "Meta de pagantes", is_active: "Ativo", label: "Nome", target_value: "Valor da meta", period_start: "Início do período",
  period_end: "Fim do período", metric_key: "Indicador", ticket_type: "Tipo de ingresso", quota_key: "Cota", receipt_year: "Ano de recebimento",
  created_by: "Criado por", codes: "Cupons", seller_names: "Nomes de quem vende", outside_ranking: "Fora do ranking", link_manual: "Ligação manual",
  credentials: "Credenciais", sync_status: "Situação da sincronização", error_message: "Mensagem de erro", last_synced_at: "Última sincronização",
  integration_name: "Integração", crm_account: "Conta do CRM", sales_window_start: "Início das vendas", sales_window_end: "Fim das vendas",
  sales_deadline: "Prazo de vendas", product_term: "Termo do produto", product_code: "Código do produto", pipelines: "Funis",
  stage_groups: "Grupos de etapas", temperature_labels: "Etiquetas de temperatura", quotas: "Cotas", product_rules: "Regras de produto",
  field_mapping: "Mapeamento de campos", deliverables: "Entregas", copied_from_event_id: "Copiado do evento", updated_by: "Alterado por",
  kind: "Tipo", ref_key: "Referência", details: "Detalhes", status: "Situação", resolution: "Resolução", resolved_by: "Resolvido por",
  resolved_at: "Resolvido em", utm_content: "UTM do e-mail", rd_campaign_id: "Campanha do RD", decision: "Decisão", decided_by: "Decidido por",
  decided_at: "Decidido em", key: "Chave", value: "Valor", coupon_code: "Cupom", deleted_at: "Excluído em", sort_order: "Ordem",
  created_at: "Criado em", updated_at: "Alterado em", source: "Origem", totals: "Totais", issues: "Problemas", decisions: "Decisões",
  tabela: "Tabela", modo: "Modo", novos: "Novos", alterados: "Alterados", removidos: "Removidos", last_error: "Último erro",
  email_novo: "E-mail novo", funcao: "Função", ver_como_equipe: "Ver como a equipe", filtros: "Filtros", linhas: "Linhas",
};

export function nomeCampo(c: string): string {
  if (CAMPOS[c]) return CAMPOS[c];
  const t = c.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const VALOR_OCULTO = "••••";

export function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v === VALOR_OCULTO) return "valor oculto";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 300 ? `${s.slice(0, 297)}…` : s;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return formatarQuando(s);
  return s;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Só os campos que mudaram (edição) ou os preenchidos (criação e exclusão).
const INTEGRACOES: Record<string, string> = {
  sympla: "Sympla", meta: "Meta Ads", google_ads: "Google Ads", google_analytics: "Google Analytics", rd_station: "RD Station", pipedrive: "Pipedrive",
};

// Nome legível do registro afetado (funções e integrações em português).
export function rotuloRegistro(l: Pick<LogLinha, "entidade" | "entidade_rotulo">): string | null {
  const r = l.entidade_rotulo;
  if (!r) return null;
  if (l.entidade === "user_roles") return r.replace(/ · (admin|viewer|seller)$/, (_, p) => ` · ${nomePapel(p)}`);
  if (l.entidade === "integrations" || l.entidade === "event_integrations") return INTEGRACOES[r] ?? r;
  return r;
}

export function comparacao(l: Pick<LogLinha, "acao" | "campos_alterados" | "dados_antes" | "dados_depois">) {
  const antes = obj(l.dados_antes);
  const depois = obj(l.dados_depois);
  const temAntes = Object.keys(antes).length > 0;
  const temDepois = Object.keys(depois).length > 0;
  let campos: string[];
  if (temAntes && temDepois) campos = l.campos_alterados?.length ? l.campos_alterados : Object.keys(depois).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]));
  else campos = Object.keys(temDepois ? depois : antes).filter((k) => (temDepois ? depois : antes)[k] !== null && k !== "linhas");
  const valor = (c: string, v: unknown) => (c === "role" && typeof v === "string" ? nomePapel(v) : formatarValor(v));
  return campos.map((c) => ({
    campo: c,
    rotulo: nomeCampo(c),
    antes: temAntes ? valor(c, antes[c]) : null,
    depois: temDepois ? valor(c, depois[c]) : null,
    oculto: antes[c] === VALOR_OCULTO || depois[c] === VALOR_OCULTO,
  }));
}

// ---------- Datas ----------
export function formatarQuando(iso: string, curto = false): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", ...(curto ? {} : { year: "numeric" }), hour: "2-digit", minute: "2-digit", ...(curto ? {} : { second: "2-digit" }),
  }).format(d);
}

export function relativo(iso: string | number, agora: number): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 45) return "agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

// ---------- CSV (Excel em português: ponto e vírgula e acentos preservados) ----------
function celula(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsv(linhas: LogLinha[]): string {
  const cab = ["Quando (Brasília)", "Quem", "E-mail", "Função", "Origem", "Processo", "Ação", "Categoria", "Tela", "Registro", "Evento", "Campos alterados", "Linhas", "Resultado", "Detalhe do erro", "IP"];
  const corpo = linhas.map((l) => {
    const q = quem(l);
    return [
      formatarQuando(l.ocorrido_em), q.nome, l.actor_email, nomePapel(l.actor_papel), ORIGENS[l.actor_origem] ?? l.actor_origem,
      l.actor_processo ? nomeProcesso(l.actor_processo) : "", descreverAcao(l.acao).texto, nomeCategoria(l.categoria), l.tela,
      rotuloRegistro(l), l.event_nome, (l.campos_alterados ?? []).map(nomeCampo).join(", "), l.qtd_linhas,
      l.resultado === "erro" ? "Erro" : "Sucesso", l.detalhe_erro, l.ip ? String(l.ip) : "",
    ].map(celula).join(";");
  });
  return "\uFEFF" + [cab.join(";"), ...corpo].join("\r\n");
}

// Tela de onde veio uma ação do painel (para registros de falha e acesso negado).
const TELAS: [RegExp, string][] = [
  [/^\/settings/, "Configurações"], [/^\/goals/, "Metas"], [/^\/integrations/, "Integrações"], [/^\/logs/, "Logs"],
  [/^\/cupons/, "Cupons"], [/^\/compradores/, "Compradores"], [/^\/patrocinios/, "Patrocínios"], [/^\/comercial/, "Comercial"],
  [/^\/marketing/, "Marketing"], [/^\/perfil/, "Meu perfil"], [/^\/login/, "Login"], [/^\/set-password/, "Criar senha"], [/^\/$/, "Início"],
];
export function telaDaRota(pathname: string): string {
  return TELAS.find(([r]) => r.test(pathname))?.[1] ?? pathname;
}

// ---------- Narrativa da linha: o que aconteceu, dito na própria lista ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS_TECNICOS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by", "synced_at", "linhas", "linhas_guardadas"]);

function valorCurto(c: string, v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && c !== "sympla_event_id" && c !== "receipt_year") return Number(v).toLocaleString("pt-BR");
  if (c === "role" && typeof v === "string") return nomePapel(v);
  const s = formatarValor(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

export function narrativa(l: Pick<LogLinha, "acao" | "entidade" | "entidade_rotulo" | "campos_alterados" | "dados_antes" | "dados_depois" | "qtd_linhas" | "resultado" | "detalhe_erro">): { titulo: string; detalhe: string[] } {
  const acao = descreverAcao(l.acao).texto;
  const rot = rotuloRegistro(l);
  const titulo = rot ? `${acao} · ${rot}` : acao;
  const antes = obj(l.dados_antes);
  const depois = obj(l.dados_depois);
  const detalhe: string[] = [];

  if (l.resultado === "erro" && l.detalhe_erro) {
    const e = l.detalhe_erro.replace(/\s+/g, " ");
    detalhe.push(/403|PERMISSION_DENIED|permission/i.test(e) ? "Sem permissão na conta da integração (erro 403)" : e.length > 140 ? `${e.slice(0, 137)}…` : e);
  }

  // Sincronizações: quantidades e o que mudou.
  if (typeof depois.novos === "number") detalhe.push(`${plural(depois.novos, "registro novo entrou", "registros novos entraram")}`);
  if (typeof depois.alterados === "number") {
    const campos = (l.campos_alterados ?? []).filter((c) => !CAMPOS_TECNICOS.has(c)).map(nomeCampo);
    detalhe.push(`${plural(depois.alterados, "registro mudou", "registros mudaram")}${campos.length ? `: ${campos.slice(0, 4).join(", ")}${campos.length > 4 ? ` e mais ${campos.length - 4}` : ""}` : ""}`);
  }
  if (typeof antes.removidos === "number") detalhe.push(`${plural(antes.removidos, "registro saiu", "registros saíram")}`);
  if (detalhe.length && (typeof depois.novos === "number" || typeof depois.alterados === "number" || typeof antes.removidos === "number")) return { titulo, detalhe };

  const temAntes = Object.keys(antes).length > 0;
  const temDepois = Object.keys(depois).length > 0;
  if (temAntes && temDepois) {
    const SITUACAO: Record<string, string> = { syncing: "sincronizando", error: "com erro", success: "ok", idle: "parada" };
    for (const m of comparacao(l).filter((m) => !CAMPOS_TECNICOS.has(m.campo) && !(m.campo === "error_message" && l.resultado === "erro"))) {
      if (m.campo === "sync_status") { detalhe.push(`Situação: ${SITUACAO[String(antes.sync_status)] ?? "—"} → ${SITUACAO[String(depois.sync_status)] ?? "—"}`); continue; }
      if (m.oculto) { detalhe.push(`${m.rotulo}: alterado (valor oculto)`); continue; }
      const a = antes[m.campo], d = depois[m.campo];
      if (typeof a === "string" && UUID.test(a) || typeof d === "string" && UUID.test(d)) { detalhe.push(`${m.rotulo}: trocado`); continue; }
      detalhe.push(`${m.rotulo}: ${valorCurto(m.campo, a)} → ${valorCurto(m.campo, d)}`);
    }
  } else if (temAntes || temDepois) {
    const fonte = temDepois ? depois : antes;
    const partes = Object.entries(fonte)
      .filter(([k, v]) => !CAMPOS_TECNICOS.has(k) && v !== null && v !== "" && !(typeof v === "string" && UUID.test(v)) && typeof v !== "object")
      .slice(0, 4)
      .map(([k, v]) => `${nomeCampo(k)}: ${v === VALOR_OCULTO ? "valor oculto" : valorCurto(k, v)}`);
    if (partes.length) detalhe.push(`${temDepois ? "Inseriu" : "Tinha"} ${partes.join(" · ")}`);
  }
  return { titulo, detalhe };
}
