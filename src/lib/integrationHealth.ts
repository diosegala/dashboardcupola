// Situação de cada integração em linguagem simples, a partir do registro salvo no banco.
// Regra pura (testada em integrationHealth.test.ts) usada pela página Integrações.

import type { ChipVariant } from "@/components/Chip";

export interface IntegrationRecord {
  name: string;
  is_active: boolean;
  sync_status: string;
  last_synced_at: string | null;
  updated_at: string;
  error_message: string | null;
  credentials: unknown;
}

export interface IntegrationInfo {
  label: string;
  // O que a fonte traz para o painel.
  traz: string;
  // Intervalo do agendamento automático, em minutos.
  frequenciaMin: number;
  // Campos obrigatórios das credenciais da conta.
  campos: Array<{ key: string; label: string; type: "text" | "textarea" }>;
}

export const INTEGRATIONS: Record<string, IntegrationInfo> = {
  sympla: {
    label: "Sympla",
    traz: "Ingressos, participantes e cupons",
    frequenciaMin: 15,
    campos: [{ key: "api_token", label: "API Token (s_token)", type: "text" }],
  },
  pipedrive: {
    label: "Pipedrive",
    traz: "Negócios, patrocínios e faturados",
    frequenciaMin: 15,
    campos: [
      { key: "api_token", label: "API Token", type: "text" },
      { key: "domain", label: "Domínio (ex: company)", type: "text" },
    ],
  },
  meta: {
    label: "Meta Ads",
    traz: "Investimento e resultados dos anúncios",
    frequenciaMin: 15,
    campos: [
      { key: "access_token", label: "Access Token", type: "text" },
      { key: "ad_account_id", label: "Ad Account ID", type: "text" },
    ],
  },
  google_ads: {
    label: "Google Ads",
    traz: "Investimento e resultados dos anúncios",
    frequenciaMin: 15,
    campos: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "text" },
      { key: "refresh_token", label: "Refresh Token", type: "text" },
      { key: "developer_token", label: "Developer Token", type: "text" },
      { key: "customer_id", label: "Customer ID", type: "text" },
    ],
  },
  google_analytics: {
    label: "Google Analytics",
    traz: "Visitas e origem do tráfego do site",
    frequenciaMin: 15,
    campos: [
      { key: "property_id", label: "Property ID", type: "text" },
      { key: "service_account_json", label: "Service Account JSON", type: "textarea" },
    ],
  },
  rd_station: {
    label: "RD Station",
    traz: "E-mails enviados, aberturas e cliques",
    frequenciaMin: 60,
    campos: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "text" },
      { key: "refresh_token", label: "Refresh Token", type: "text" },
    ],
  },
};

export const ORDEM = ["sympla", "pipedrive", "meta", "google_ads", "google_analytics", "rd_station"];

export type Estado = "ok" | "sincronizando" | "atrasada" | "interrompida" | "erro" | "sem_credenciais" | "desligada";

export interface Saude {
  estado: Estado;
  label: string;
  variant: ChipVariant;
  // Funcionando = trazendo dados (em dia ou sincronizando agora).
  funcionando: boolean;
}

// Atrasada: passou três ciclos do agendamento sem concluir.
const CICLOS_ATRASO = 3;
// Uma sincronização "em andamento" há mais tempo que isso foi interrompida no meio.
const LIMITE_SINCRONIZANDO_MS = 15 * 60 * 1000;

export function credenciaisFaltando(i: Pick<IntegrationRecord, "name" | "credentials">): string[] {
  const campos = INTEGRATIONS[i.name]?.campos ?? [];
  const creds = (i.credentials && typeof i.credentials === "object" ? i.credentials : {}) as Record<string, unknown>;
  return campos.filter((c) => !String(creds[c.key] ?? "").trim()).map((c) => c.label);
}

export function saudeIntegracao(i: IntegrationRecord, agora: number = Date.now()): Saude {
  if (!i.is_active) return { estado: "desligada", label: "Desligada", variant: "neutral", funcionando: false };
  if (credenciaisFaltando(i).length) {
    return { estado: "sem_credenciais", label: "Faltam credenciais", variant: "warn", funcionando: false };
  }
  if (i.sync_status === "error") return { estado: "erro", label: "Com erro", variant: "bad", funcionando: false };

  const freqMs = (INTEGRATIONS[i.name]?.frequenciaMin ?? 15) * 60 * 1000;
  const ultima = i.last_synced_at ? new Date(i.last_synced_at).getTime() : null;
  const emDia = ultima !== null && agora - ultima <= freqMs * CICLOS_ATRASO;

  if (i.sync_status === "syncing") {
    if (agora - new Date(i.updated_at).getTime() <= LIMITE_SINCRONIZANDO_MS) {
      return { estado: "sincronizando", label: "Atualizando agora", variant: "blue", funcionando: true };
    }
    // Parou no meio; o próximo agendamento tenta de novo sozinho.
    if (!emDia) return { estado: "interrompida", label: "Interrompida", variant: "warn", funcionando: false };
  }
  if (!emDia) return { estado: "atrasada", label: "Atrasada", variant: "warn", funcionando: false };
  return { estado: "ok", label: "Funcionando", variant: "ok", funcionando: true };
}

// Explica em português as mensagens técnicas que as plataformas devolvem.
export function explicarErro(name: string, msg: string | null): string | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  if (name === "google_ads" && /only approved for use with test accounts|developer.?token.*(not approved|test)/.test(m)) {
    return "O Google ainda não liberou o acesso desta conta: o token de desenvolvedor só funciona com contas de teste. É preciso pedir o acesso Básico na Central da API do Google Ads.";
  }
  if (/(oauth|token).*(expired|invalid)|session has expired|error validating access token|code"?:\s*190/.test(m)) {
    return "A chave de acesso expirou ou foi revogada. Gere uma nova e atualize as credenciais.";
  }
  if (/\b401\b|unauthori[sz]ed|invalid_grant|invalid_client/.test(m)) {
    return "A plataforma recusou as credenciais. Confira se estão corretas e atualizadas.";
  }
  if (/\b403\b|permission|forbidden/.test(m)) {
    return "A conta conectada não tem permissão para ler esses dados.";
  }
  if (/\b429\b|rate limit|too many/.test(m)) {
    return "A plataforma limitou o número de consultas. A próxima atualização automática tenta de novo.";
  }
  if (/credenciais ausentes|missing credentials/.test(m)) return "Faltam credenciais para conectar.";
  if (/sync parcial/.test(m)) return msg;
  return "A última atualização falhou. A próxima tentativa automática pode resolver.";
}

export function frequenciaTexto(min: number): string {
  return min >= 60 ? `a cada ${min / 60 === 1 ? "hora" : `${min / 60} horas`}` : `a cada ${min} min`;
}
