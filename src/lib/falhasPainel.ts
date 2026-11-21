// Ouvinte único de falhas do painel: toda gravação recusada pelo banco ou pelas funções do servidor vira um registro
// "tentou e falhou" no log, sem depender de cada tela lembrar. Precisa ser o primeiro import do app (main.tsx),
// antes do cliente do banco ser criado. Não importa o cliente: chama a API direto, com o mesmo login da pessoa.
import { telaDaRota } from "./activityLog";

const BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function lerCabecalho(input: RequestInfo | URL, init: RequestInit | undefined, nome: string): string | null {
  const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  if (!h) return null;
  if (h instanceof Headers) return h.get(nome);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === nome.toLowerCase())?.[1] ?? null;
  const rec = h as Record<string, string>;
  return rec[nome] ?? rec[nome.toLowerCase()] ?? null;
}

export function analisarFalha(url: string, metodo: string, status: number, base: string): { acao: "falha.gravacao" | "falha.funcao"; entidade: string } | null {
  if (status < 400 || status === 401) return null;
  if (!url.startsWith(base)) return null;
  const caminho = url.slice(base.length).split("?")[0];
  if (caminho.startsWith("/rest/v1/rpc/registrar_atividade")) return null;
  if (caminho.startsWith("/rest/v1/rpc/")) return { acao: "falha.funcao", entidade: caminho.slice("/rest/v1/rpc/".length) };
  if (caminho.startsWith("/rest/v1/")) {
    if (metodo === "GET" || metodo === "HEAD") return null;
    return { acao: "falha.gravacao", entidade: caminho.slice("/rest/v1/".length) };
  }
  if (caminho.startsWith("/functions/v1/")) return { acao: "falha.funcao", entidade: caminho.slice("/functions/v1/".length) };
  return null;
}

function instalar() {
  if (typeof window === "undefined" || !BASE || !CHAVE || (window as { __falhasPainel?: boolean }).__falhasPainel) return;
  (window as { __falhasPainel?: boolean }).__falhasPainel = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const metodo = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const falha = analisarFalha(url, metodo, res.status, BASE);
      const auth = lerCabecalho(input, init, "Authorization");
      if (falha && auth && !auth.endsWith(CHAVE)) {
        const corpo = await res.clone().json().catch(() => null);
        const mensagem = String(corpo?.message ?? corpo?.error ?? corpo?.msg ?? `Erro ${res.status}`).slice(0, 500);
        void original(`${BASE}/rest/v1/rpc/registrar_atividade`, {
          method: "POST",
          headers: { apikey: CHAVE, Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            p_acao: falha.acao,
            p_entidade: falha.entidade.slice(0, 80),
            p_tela: telaDaRota(window.location.pathname),
            p_resultado: "erro",
            p_detalhe: mensagem,
            p_dados: { metodo, status: res.status },
          }),
        }).catch(() => undefined);
      }
    } catch {
      /* o registro de falha nunca atrapalha a tela */
    }
    return res;
  };
}

instalar();
