export type Row = Record<string, any>;
export const LIMIT_MESSAGE = 'Limite diário do Pipedrive atingido; retoma sozinho quando o dia virar';
export const LOW_RATE_MESSAGE = 'Saldo do limite do Pipedrive abaixo de 5%; sincronização interrompida para preservar o limite';
export function accountDomain(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Domínio do Pipedrive inválido');
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.pipedrive\.com$/, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) throw new Error('Domínio do Pipedrive inválido');
  return domain;
}
export const normalized = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const matchesTerm = (row: Row, term: unknown) => Boolean(String(term ?? '').trim()) && [row.name, row.code].some(v => normalized(v).includes(normalized(term).trim()));
export const pipelineIds = (config: Row): number[] => (Array.isArray(config.pipelines) ? config.pipelines : []).map((p: Row) => Number(p.pipeline_pd_id)).filter((id: number) => Number.isSafeInteger(id) && id > 0);
export const scalarId = (v: any): number | null => { const id = Number(typeof v === 'object' && v ? v.id ?? v.value : v); return Number.isSafeInteger(id) && id > 0 ? id : null; };
export const labels = (v: any): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String);
export const customFields = (v: Row) => ({ ...Object.fromEntries(Object.entries(v).filter(([k]) => /^[a-f0-9]{40}$/i.test(k))), ...(v.custom_fields ?? {}) });
export const iso = (v: unknown) => { if (!v) return null; const date = new Date(String(v).includes('T') ? String(v) : String(v).replace(' ', 'T') + (String(v).length > 10 ? 'Z' : 'T00:00:00Z')); return Number.isFinite(date.getTime()) ? date.toISOString() : null; };
export function isBusy(state: Row | null, now = Date.now()): boolean {
  return Boolean(state?.last_started_at && now - Date.parse(state.last_started_at) < 600000 && (!state.last_success_at || Date.parse(state.last_success_at) < Date.parse(state.last_started_at)));
}
export function retryDelay(attempt: number, retryAfter: string | null, now = Date.now()): number {
  const numeric = retryAfter === null ? NaN : Number(retryAfter);
  const supplied = Number.isFinite(numeric) ? numeric * 1000 : retryAfter ? Date.parse(retryAfter) - now : 0;
  return Math.max(2000 * 2 ** attempt, Number.isFinite(supplied) ? supplied : 0);
}
export const safeFields = (fields: Row[]) => fields.map(f => ({ key: f.key, name: f.name, field_type: f.field_type, edit_flag: f.edit_flag, active_flag: f.active_flag, ...(!['user', 'people', 'org'].includes(f.field_type) ? { options: (f.options ?? []).map((o: Row) => ({ id: o.id, label: o.label })) } : {}) }));
