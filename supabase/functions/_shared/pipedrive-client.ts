import { accountDomain, LIMIT_MESSAGE, LOW_RATE_MESSAGE, retryDelay, type Row } from './pipedrive-rules.ts';
export class PipedriveError extends Error { constructor(message: string, public status = 502, public providerStatus?: number) { super(message); } }
export class PartialRun extends Error { constructor() { super('Sincronização parcial; continua na próxima execução'); } }
export class PipedriveClient {
  rate: Row = {}; lastCall = 0;
  constructor(private account: string, private token: string, public deadline = Infinity, private request: typeof fetch = fetch, private wait: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))) { accountDomain(account); }
  async get(path: string, query: Row = {}): Promise<Row> {
    if (!/^\/api\/v[12]\/[a-zA-Z0-9/_-]+$/.test(path)) throw new PipedriveError('Caminho de leitura inválido', 400);
    if (this.rate.limit > 0 && this.rate.remaining < this.rate.limit * .05) throw new PipedriveError(LOW_RATE_MESSAGE, 503, 429);
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (Date.now() > this.deadline - 3000) throw new PartialRun();
      await this.wait(Math.max(0, 50 - (Date.now() - this.lastCall)));
      const url = new URL(`https://${accountDomain(this.account)}.pipedrive.com${path}`);
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      let res: Response;
      try { this.lastCall = Date.now(); res = await this.request(url, { method: 'GET', headers: { 'x-api-token': this.token, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(20000, this.deadline - Date.now()))) }); }
      catch { if (Date.now() >= this.deadline - 3000) throw new PartialRun(); throw new PipedriveError('Não foi possível conectar ao Pipedrive; tente novamente', 503); }
      const limit = res.headers.get('x-daily-ratelimit-token-limit'); const remaining = res.headers.get('x-daily-ratelimit-token-remaining');
      if (limit !== null && remaining !== null && Number.isFinite(Number(limit)) && Number.isFinite(Number(remaining))) this.rate = { limit: Number(limit), remaining: Number(remaining), at: new Date().toISOString() };
      if (res.status === 429) {
        if (attempt === 3) throw new PipedriveError(LIMIT_MESSAGE, 503, 429);
        const delay = retryDelay(attempt, res.headers.get('Retry-After'));
        if (Date.now() + delay >= this.deadline - 3000) throw new PipedriveError(LIMIT_MESSAGE, 503, 429);
        await this.wait(delay); continue;
      }
      if (!res.ok) throw new PipedriveError(`Pipedrive respondeu ${res.status}: ${[401,403].includes(res.status) ? 'token inválido ou sem permissão' : res.status === 404 ? 'recurso não encontrado' : 'falha ao ler os dados'}`, 502, res.status);
      let body: Row; try { body = await res.json(); } catch { throw new PipedriveError('Pipedrive devolveu uma resposta inválida', 502); }
      if (body.success === false) throw new PipedriveError('Pipedrive não conseguiu concluir a leitura', 502);
      return body;
    }
    throw new PipedriveError(LIMIT_MESSAGE, 503, 429);
  }
  async page(path: string, query: Row = {}, marker?: string | number): Promise<{ rows: Row[]; next?: string | number }> {
    const v2 = path.startsWith('/api/v2/');
    const body = await this.get(path, { limit: 500, ...query, ...(marker !== undefined ? { [v2 ? 'cursor' : 'start']: marker } : {}) });
    if (body.data !== null && !Array.isArray(body.data)) throw new PipedriveError('Pipedrive devolveu uma lista inválida', 502);
    const pagination = body.additional_data?.pagination;
    return { rows: body.data ?? [], next: v2 ? body.additional_data?.next_cursor ?? undefined : pagination?.more_items_in_collection ? pagination.next_start : undefined };
  }
  async all(path: string, query: Row = {}): Promise<Row[]> {
    const rows: Row[] = []; let next: string | number | undefined;
    do { const page = await this.page(path, query, next); rows.push(...page.rows); if (page.next !== undefined && page.next === next) throw new PipedriveError('Paginação inválida do Pipedrive'); next = page.next; } while (next !== undefined);
    return rows;
  }
}
