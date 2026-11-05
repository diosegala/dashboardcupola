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
export function inWindow(deal: Row, config: Row): boolean {
  if (!config.sales_window_start || !deal.won_at) return false;
  const day = String(deal.won_at).slice(0, 10);
  return day >= config.sales_window_start && day <= (config.sales_window_end ?? config.events?.end_date ?? '9999-12-31');
}
export function isBusy(state: Row | null, now = Date.now()): boolean {
  return Boolean(state?.last_started_at && now - Date.parse(state.last_started_at) < 600000 && (!state.last_success_at || Date.parse(state.last_success_at) < Date.parse(state.last_started_at)));
}
export function retryDelay(attempt: number, retryAfter: string | null, now = Date.now()): number {
  const numeric = retryAfter === null ? NaN : Number(retryAfter);
  const supplied = Number.isFinite(numeric) ? numeric * 1000 : retryAfter ? Date.parse(retryAfter) - now : 0;
  return Math.max(2000 * 2 ** attempt, Number.isFinite(supplied) ? supplied : 0);
}
export function pendingCandidates(configs: Row[], products: Row[], stages: Row[], deals: Row[], lines: Row[]): Row[] {
  const candidates: Row[] = [];
  const add = (c: Row, kind: string, ref: unknown, details: Row, deal?: Row) => candidates.push({ event_id: c.event_id, kind, ref_key: String(ref), details, deal_id: deal?.id ?? null });
  for (const c of configs) {
    const pipes = pipelineIds(c);
    const rules = Array.isArray(c.product_rules) ? c.product_rules : [];
    for (const p of products.filter(p => p.kind === 'product' && !p.is_deleted && matchesTerm(p, c.product_term))) {
      if (!rules.some((r: Row) => String(r.product_pd_id ?? r.pd_id) === String(p.pd_id))) add(c, 'produto_novo', p.pd_id, { produto: p.name });
    }
    for (const stage of stages.filter(s => !s.is_deleted && pipes.includes(s.pipeline_pd_id))) {
      const groups = c.stage_groups ?? {};
      const mapped = Array.isArray(groups) ? groups.some((g: Row) => Number(g.stage_pd_id) === stage.pd_id) : Object.prototype.hasOwnProperty.call(groups, String(stage.pd_id)) || Object.values(groups).some(v => Array.isArray(v) && v.map(String).includes(String(stage.pd_id)));
      if (!mapped) add(c, 'etapa_nova', stage.pd_id, { etapa: stage.name });
    }
    for (const d of deals.filter(d => !d.is_deleted && pipes.includes(d.pipeline_pd_id))) {
      const active = lines.filter(l => l.deal_id === d.id && l.is_enabled);
      if (d.status === 'won' && inWindow(d, c) && !active.length) add(c, 'ganho_sem_produto', d.pipedrive_deal_id, { negocio: d.title }, d);
      if (d.status === 'open' && !active.length && configs.filter(other => pipelineIds(other).includes(d.pipeline_pd_id)).length > 1) add(c, 'aberto_sem_produto', d.pipedrive_deal_id, { negocio: d.title }, d);
      if (d.status === 'won') {
        const ambiguous = active.flatMap(line => {
          const p = products.find(p => p.kind === 'product' && p.pd_id === line.product_pd_id);
          return p ? [configs.filter(other => pipelineIds(other).includes(d.pipeline_pd_id) && inWindow(d, other) && normalized(p.name).includes(normalized(other.product_term)) && String(other.product_term ?? '').trim())] : [];
        }).filter(list => list.length > 1 && list.some(other => other.event_id === c.event_id));
        if (ambiguous.length) add(c, 'edicao_ambigua', d.pipedrive_deal_id, { negocio: d.title, candidatos: [...new Map(ambiguous.flat().map(other => [other.event_id, { event_id: other.event_id, nome: other.events?.name }])).values()] }, d);
      }
    }
  }
  return candidates;
}
export const safeFields = (fields: Row[]) => fields.map(f => ({ key: f.key, name: f.name, field_type: f.field_type, edit_flag: f.edit_flag, active_flag: f.active_flag, ...(!['user', 'people', 'org'].includes(f.field_type) ? { options: (f.options ?? []).map((o: Row) => ({ id: o.id, label: o.label })) } : {}) }));
