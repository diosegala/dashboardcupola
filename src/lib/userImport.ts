// Importação de pessoas por evento: leitura da planilha, combinação de colunas e classificação de cada linha.
// Funções puras (sem banco): a tela monta a "base" atual e aplica as decisões de quem importa.
// Regra geral: a planilha só adiciona. Quem não está nela não muda; papel e nome de quem já existe não mudam.
import { erroEmail, limparEmail } from "@/lib/email";
import { formatPersonName } from "@/lib/personName";
import { cleanCodeInput } from "@/lib/couponLink";
import { ROLES } from "@/lib/roles";

// ---------- Campos e combinação de colunas ----------

export type Campo = "first" | "last" | "email" | "role" | "coupons";

export const CAMPOS: { id: Campo; titulo: string; sinonimos: string[] }[] = [
  { id: "first", titulo: "Nome", sinonimos: ["nome", "primeiro nome", "first name", "name"] },
  { id: "last", titulo: "Sobrenome", sinonimos: ["sobrenome", "ultimo nome", "last name", "surname"] },
  { id: "email", titulo: "E-mail", sinonimos: ["e-mail", "email", "e mail", "mail"] },
  { id: "role", titulo: "Função", sinonimos: ["funcao", "papel", "perfil", "role", "cargo de acesso"] },
  { id: "coupons", titulo: "Cupons", sinonimos: ["cupons", "cupom", "codigo", "codigos", "coupon", "coupons"] },
];

const chave = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();

// Título igual ao do modelo (sem diferenciar maiúsculas e acentos) ou sinônimo conhecido já vem combinado.
export function combinarColunas(titulos: string[]): (Campo | null)[] {
  const usados = new Set<Campo>();
  return titulos.map((t) => {
    const k = chave(t);
    const campo = CAMPOS.find((c) => !usados.has(c.id) && (chave(c.titulo) === k || c.sinonimos.includes(k)));
    if (!campo) return null;
    usados.add(campo.id);
    return campo.id;
  });
}

// ---------- Leitura de CSV (vírgula, ponto e vírgula ou tabulação) ----------

export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// ---------- Linhas da planilha ----------

export interface LinhaPlanilha {
  linha: number; // número da linha na planilha (o título é a linha 1)
  first: string;
  last: string;
  email: string;
  role: string; // texto como veio
  coupons: string[];
}

export function montarLinhas(tabela: string[][], combinacao: (Campo | null)[]): LinhaPlanilha[] {
  const col = (c: Campo) => combinacao.indexOf(c);
  const pega = (row: string[], c: Campo) => (col(c) >= 0 ? String(row[col(c)] ?? "").trim() : "");
  return tabela.slice(1).map((row, i) => ({
    linha: i + 2,
    first: pega(row, "first"),
    last: pega(row, "last"),
    email: pega(row, "email"),
    role: pega(row, "role"),
    coupons: separarCupons(pega(row, "coupons")),
  }));
}

export function separarCupons(v: string): string[] {
  return Array.from(new Set(v.split(/[,;\n]+/).map((c) => cleanCodeInput(c.trim()).replace(/,/g, "")).filter(Boolean)));
}

// Função escrita na planilha → papel. Só as funções aceitas na importação valem (nunca Administrador).
export function papelDaPlanilha(texto: string): { role: string | null; motivo: string | null } {
  const k = chave(texto);
  if (!k) return { role: null, motivo: "Informe a função: " + funcoesAceitas() };
  const r = ROLES.find((x) => chave(x.label) === k || x.value === k);
  if (!r) return { role: null, motivo: `Função "${texto}" não existe. Use: ${funcoesAceitas()}` };
  if (!r.importable) return { role: null, motivo: `A importação não cria ${r.label}. Use: ${funcoesAceitas()}` };
  return { role: r.value, motivo: null };
}
export const funcoesAceitas = () => ROLES.filter((r) => r.importable).map((r) => r.label).join(" ou ");

// Linhas de exemplo do modelo: ignoradas sozinhas se alguém esquecer de apagar.
export const EMAIL_EXEMPLO = /@exemplo\.com(\.br)?$/i;

// ---------- Base atual ----------

export interface PessoaBase { id: string; email: string; name: string | null; role: string; disabled: boolean }
export interface FichaBase { id: string; name: string; codes: string[]; userId: string | null }
export interface Base {
  pessoas: PessoaBase[];
  acesso: Map<string, { allEvents: boolean; eventIds: string[] }>;
  fichas: FichaBase[];
  vendasPorCupom: Map<string, number>;
  eventId: string;
  adminRole: string;
}

// ---------- Decisões de quem importa ----------

export type DecisaoCupom = { tipo: "manter" } | { tipo: "transferir" } | { tipo: "outro"; codigo: string };
export interface Decisao {
  ignorar?: boolean;
  edicao?: Partial<Pick<LinhaPlanilha, "first" | "last" | "email" | "role">>;
  reativar?: boolean;
  cupons?: Record<string, DecisaoCupom>;
}

// ---------- Resultado da conferência ----------

export type Problema =
  | { tipo: "dados"; campos: ("first" | "last" | "email" | "role")[]; motivos: string[] }
  | { tipo: "cupom_de_outro"; codigo: string; dono: string; donoUserId: string | null; fichaId: string; vendas: number; donoFicaSemCupom: boolean }
  | { tipo: "cupom_repetido"; codigo: string; linhaOriginal: number }
  | { tipo: "inativo" };

export interface Transferencia { codigo: string; fichaOrigem: string; dono: string; vendas: number; donoFicaSemCupom: boolean }

export interface Plano {
  convidar?: { email: string; name: string; role: string };
  userId?: string;
  liberarEvento: boolean;
  reativar: boolean;
  ligarFichas: string[]; // fichas sem dono que já tinham o código
  novosCodigos: string[]; // códigos que ainda não existem em nenhuma ficha
  transferencias: Transferencia[];
}

export type Situacao = "nova" | "existente" | "sem_mudanca" | "ignorada" | "exemplo" | "vazia" | "repetida";

export interface Resultado {
  linha: number;
  email: string;
  nome: string;
  situacao: Situacao;
  repetidaDe?: number;
  pendentes: Problema[]; // problemas ainda sem decisão: impedem importar
  resolvidos: Problema[]; // problemas com decisão tomada (ficam no registro)
  plano?: Plano;
}

export function conferir(linhas: LinhaPlanilha[], base: Base, decisoes: Record<number, Decisao>): Resultado[] {
  const porEmail = new Map(base.pessoas.map((p) => [limparEmail(p.email), p]));
  const fichaDoCodigo = new Map<string, FichaBase>();
  base.fichas.forEach((f) => f.codes.forEach((c) => { const k = c.trim().toUpperCase(); if (k) fichaDoCodigo.set(k, f); }));
  const nomeDoUsuario = (id: string | null) => (id ? base.pessoas.find((p) => p.id === id)?.name ?? "outra pessoa" : null);
  const emailsVistos = new Map<string, number>();
  const codigosVistos = new Map<string, number>();

  return linhas.map((original): Resultado => {
    const d = decisoes[original.linha] ?? {};
    const l = { ...original, ...d.edicao };
    const email = limparEmail(l.email);
    const nome = formatPersonName(`${l.first} ${l.last}`) || email;
    const vazio = !l.first && !l.last && !l.email && !l.role && !original.coupons.length;
    const base0 = { linha: l.linha, email, nome, pendentes: [] as Problema[], resolvidos: [] as Problema[] };

    if (vazio) return { ...base0, situacao: "vazia" };
    if (EMAIL_EXEMPLO.test(email)) return { ...base0, situacao: "exemplo" };
    if (d.ignorar) return { ...base0, situacao: "ignorada" };
    if (email && !erroEmail(email) && emailsVistos.has(email)) return { ...base0, situacao: "repetida", repetidaDe: emailsVistos.get(email) };

    const pessoa = email ? porEmail.get(email) : undefined;
    const pendentes: Problema[] = [];
    const resolvidos: Problema[] = [];

    // Dados obrigatórios: e-mail sempre; nome, sobrenome e função só para quem é novo.
    const campos: ("first" | "last" | "email" | "role")[] = [];
    const motivos: string[] = [];
    const errEmail = erroEmail(l.email);
    if (errEmail) { campos.push("email"); motivos.push(errEmail); }
    let role: string | null = null;
    if (!pessoa) {
      if (!l.first.trim()) { campos.push("first"); motivos.push("Falta o nome"); }
      if (!l.last.trim()) { campos.push("last"); motivos.push("Falta o sobrenome"); }
      const p = papelDaPlanilha(l.role);
      role = p.role;
      if (p.motivo) { campos.push("role"); motivos.push(p.motivo); }
    }
    if (campos.length) pendentes.push({ tipo: "dados", campos, motivos });
    if (email && !errEmail) emailsVistos.set(email, l.linha);

    // Inativo: só entra se quem importa decidir reativar.
    if (pessoa?.disabled) (d.reativar ? resolvidos : pendentes).push({ tipo: "inativo" });

    // Cupons
    const plano: Plano = { liberarEvento: false, reativar: !!(pessoa?.disabled && d.reativar), ligarFichas: [], novosCodigos: [], transferencias: [] };
    const fichasDaPessoa = pessoa ? base.fichas.filter((f) => f.userId === pessoa.id) : [];
    for (const codigoPlanilha of original.coupons) {
      const dc = d.cupons?.[codigoPlanilha];
      const codigo = dc?.tipo === "outro" ? cleanCodeInput(dc.codigo).replace(/,/g, "") : codigoPlanilha;
      if (!codigo) continue;
      const repetidoNaLinha = codigosVistos.get(codigo);
      if (repetidoNaLinha !== undefined && repetidoNaLinha !== l.linha) {
        const prob: Problema = { tipo: "cupom_repetido", codigo: codigoPlanilha, linhaOriginal: repetidoNaLinha };
        (dc?.tipo === "manter" ? resolvidos : pendentes).push(prob);
        continue;
      }
      codigosVistos.set(codigo, l.linha);
      const ficha = fichaDoCodigo.get(codigo);
      if (ficha && pessoa && ficha.userId === pessoa.id) continue; // já é dela
      if (ficha && !ficha.userId) { if (!plano.ligarFichas.includes(ficha.id)) plano.ligarFichas.push(ficha.id); continue; }
      if (ficha) {
        const outrosCodigosDoDono = base.fichas.filter((f) => f.userId === ficha.userId).flatMap((f) => f.codes).filter((c) => c.trim().toUpperCase() !== codigo);
        const prob: Problema = {
          tipo: "cupom_de_outro", codigo: codigoPlanilha, dono: nomeDoUsuario(ficha.userId) ?? ficha.name, donoUserId: ficha.userId,
          fichaId: ficha.id, vendas: base.vendasPorCupom.get(codigo) ?? 0, donoFicaSemCupom: outrosCodigosDoDono.length === 0,
        };
        if (!dc || dc.tipo === "outro") { pendentes.push(prob); continue; }
        resolvidos.push(prob);
        if (dc.tipo === "transferir") plano.transferencias.push({ codigo, fichaOrigem: ficha.id, dono: prob.dono, vendas: prob.vendas, donoFicaSemCupom: prob.donoFicaSemCupom });
        continue;
      }
      plano.novosCodigos.push(codigo);
    }

    // Evento: administrador e quem vê todos não mudam; os demais somam este evento.
    if (pessoa) {
      const ac = base.acesso.get(pessoa.id);
      const vêTudo = pessoa.role === base.adminRole || !!ac?.allEvents;
      plano.liberarEvento = !vêTudo && !(ac?.eventIds ?? []).includes(base.eventId);
      plano.userId = pessoa.id;
    } else {
      plano.liberarEvento = true;
      if (role) plano.convidar = { email, name: formatPersonName(`${l.first} ${l.last}`), role };
    }

    const muda = !pessoa || plano.liberarEvento || plano.reativar || plano.ligarFichas.length > 0 || plano.novosCodigos.length > 0 || plano.transferencias.length > 0;
    const situacao: Situacao = !pessoa ? "nova" : muda ? "existente" : "sem_mudanca";
    return { ...base0, nome: pessoa?.name || nome, situacao, pendentes, resolvidos, plano: pendentes.length ? undefined : plano };
  });
}

export function resumo(resultados: Resultado[]) {
  const conta = (s: Situacao) => resultados.filter((r) => r.situacao === s).length;
  const comPendencia = resultados.filter((r) => r.pendentes.length).length;
  const prontas = resultados.filter((r) => (r.situacao === "nova" || r.situacao === "existente") && !r.pendentes.length).length;
  return {
    prontas,
    novas: resultados.filter((r) => r.situacao === "nova" && !r.pendentes.length).length,
    atualizadas: resultados.filter((r) => r.situacao === "existente" && !r.pendentes.length).length,
    semMudanca: conta("sem_mudanca"),
    ignoradas: conta("ignorada"),
    repetidas: conta("repetida"),
    exemplos: conta("exemplo"),
    comPendencia,
  };
}
