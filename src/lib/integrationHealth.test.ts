import { describe, expect, it } from "vitest";
import { credenciaisFaltando, explicarErro, saudeIntegracao, type IntegrationRecord } from "./integrationHealth";

const AGORA = new Date("2026-11-10T13:10:00Z").getTime();
const minAtras = (n: number) => new Date(AGORA - n * 60 * 1000).toISOString();

const base = (over: Partial<IntegrationRecord> = {}): IntegrationRecord => ({
  name: "sympla",
  is_active: true,
  sync_status: "idle",
  last_synced_at: minAtras(10),
  updated_at: minAtras(10),
  error_message: null,
  credentials: { api_token: "x" },
  ...over,
});

describe("saudeIntegracao", () => {
  it("em dia quando concluiu dentro de três ciclos do agendamento", () => {
    expect(saudeIntegracao(base({ last_synced_at: minAtras(44) }), AGORA).estado).toBe("ok");
    expect(saudeIntegracao(base({ last_synced_at: minAtras(46) }), AGORA).estado).toBe("atrasada");
  });

  it("RD Station atualiza de hora em hora, então só atrasa depois de 3 horas", () => {
    const rd = { name: "rd_station", credentials: { client_id: "a", client_secret: "b", refresh_token: "c" } };
    expect(saudeIntegracao(base({ ...rd, last_synced_at: minAtras(170) }), AGORA).estado).toBe("ok");
    expect(saudeIntegracao(base({ ...rd, last_synced_at: minAtras(190) }), AGORA).estado).toBe("atrasada");
  });

  it("sincronização parada há mais de 15 minutos conta como interrompida", () => {
    const parada = base({ sync_status: "syncing", updated_at: minAtras(20), last_synced_at: minAtras(60) });
    expect(saudeIntegracao(parada, AGORA).estado).toBe("interrompida");
    const andando = base({ sync_status: "syncing", updated_at: minAtras(2) });
    expect(saudeIntegracao(andando, AGORA).estado).toBe("sincronizando");
  });

  it("desligada e sem credenciais não contam como funcionando", () => {
    expect(saudeIntegracao(base({ is_active: false }), AGORA)).toMatchObject({ estado: "desligada", funcionando: false });
    expect(saudeIntegracao(base({ credentials: {} }), AGORA)).toMatchObject({ estado: "sem_credenciais", funcionando: false });
    expect(saudeIntegracao(base({ sync_status: "error" }), AGORA)).toMatchObject({ estado: "erro", funcionando: false });
  });
});

describe("credenciaisFaltando", () => {
  it("lista só os campos obrigatórios vazios", () => {
    expect(credenciaisFaltando({ name: "pipedrive", credentials: { api_token: "x", domain: " " } })).toEqual(["Domínio (ex: company)"]);
  });
});

describe("explicarErro", () => {
  it("explica o bloqueio do Google Ads para contas reais", () => {
    const msg = 'Google Ads API 403: "The Google Cloud project is only approved for use with test accounts."';
    expect(explicarErro("google_ads", msg)).toMatch(/acesso Básico/);
  });
});
