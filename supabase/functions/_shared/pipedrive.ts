import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { accountDomain, customFields, iso, labels, matchesTerm, pipelineIds, scalarId, type Row } from './pipedrive-rules.ts';
import { PipedriveClient, PipedriveError, PartialRun } from './pipedrive-client.ts';
export { PipedriveClient, PipedriveError, PartialRun, accountDomain, pipelineIds, scalarId, matchesTerm };
export type { Row };
export const json = (body: Row, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
export const preflight = (req: Request) => req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
export function serverClient() {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new PipedriveError('Configuração do servidor indisponível', 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function checked<T>(query: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new PipedriveError(`Não foi possível gravar ou ler os dados do CRM (${error.code ?? 'erro interno'})`, 500);
  return data;
}
export async function authorize(req: Request, db: SupabaseClient, scheduled = false) {
  if (req.method !== 'POST') throw new PipedriveError('Use uma chamada POST', 405);
  const auth = req.headers.get('Authorization');
  if (scheduled && !auth) {
    const timestamp = req.headers.get('x-crm-time') ?? '';
    const account = req.headers.get('x-crm-account') ?? '';
    const signature = req.headers.get('x-crm-signature') ?? '';
    if (timestamp && account && Math.abs(Date.now() - Date.parse(timestamp)) < 300000 && /^[a-f0-9]{64}$/.test(signature)) {
      const body = await req.clone().json().catch(() => null);
      if (body?.crm_account === account && body?.scheduled_at === timestamp && Object.keys(body).every(k => ['crm_account','scheduled_at'].includes(k))) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(await resolveToken(db, accountDomain(account))), { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
        const bytes = new Uint8Array(signature.match(/.{2}/g)?.map(x => parseInt(x,16)) ?? []);
        if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${account}:${timestamp}`))) return;
      }
    }
  }
  if (!auth?.startsWith('Bearer ')) throw new PipedriveError('Não autorizado', 401);
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) throw new PipedriveError('Configuração de autenticação indisponível', 500);
  const user = createClient(url, key, { global: { headers: { Authorization: auth } } });
  const { data, error } = await user.auth.getClaims(auth.slice(7));
  if (error || !data?.claims?.sub) throw new PipedriveError('Sessão inválida', 401);
  const roles = await checked(db.from('user_roles').select('role').eq('user_id', data.claims.sub).eq('role', 'admin').maybeSingle());
  if (!roles) throw new PipedriveError('Apenas administradores podem acessar o Pipedrive', 403);
}
export async function constantEqual(a: string, b: string) {
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let different = 0; for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0 && Boolean(a) && Boolean(b);
}
export async function configsFor(db: SupabaseClient, account?: string, active = true): Promise<Row[]> {
  let q = db.from('sponsorship_config').select('*, events!inner(id,name,end_date,is_active)');
  if (active) q = q.eq('events.is_active', true);
  if (account) q = q.eq('crm_account', accountDomain(account));
  return (await checked(q) ?? []).filter((c: Row) => c.crm_account?.trim());
}
export async function resolveAccount(db: SupabaseClient, input: Row): Promise<string> {
  if (input.event_id) {
    const c = await checked(db.from('sponsorship_config').select('crm_account').eq('event_id', input.event_id).maybeSingle());
    if (!c?.crm_account) throw new PipedriveError('Conta do Pipedrive não configurada para este evento', 400);
    const account = accountDomain(c.crm_account);
    if (input.crm_account && accountDomain(input.crm_account) !== account) throw new PipedriveError('A conta não corresponde ao evento', 400);
    return account;
  }
  return accountDomain(input.crm_account);
}
export async function resolveToken(db: SupabaseClient, account: string): Promise<string> {
  const configs = await configsFor(db, account, false);
  if (!configs.length) throw new PipedriveError('Conta do Pipedrive não vinculada a um evento', 404);
  const overrides = await checked(db.from('event_integrations').select('credentials').eq('integration_name', 'pipedrive').in('event_id', configs.map(c => c.event_id)));
  const valid = (credentials: Row | null) => {
    if (!credentials?.api_token || !credentials.domain) return null;
    try { return accountDomain(credentials.domain) === account ? String(credentials.api_token).trim() : null; } catch { return null; }
  };
  for (const item of overrides ?? []) { const token = valid(item.credentials); if (token) return token; }
  const global = await checked(db.from('integrations').select('credentials').eq('name', 'pipedrive').maybeSingle());
  const token = valid(global?.credentials);
  if (!token) throw new PipedriveError('Token não configurado para esta conta do Pipedrive; preencha token e domínio em Integrações', 400);
  return token;
}
export async function allRows(db: SupabaseClient, table: string, account: string): Promise<Row[]> {
  const rows: Row[] = []; let offset = 0;
  while (true) { const page = await checked(db.from(table).select('*').eq('crm_account', account).order(table === 'crm_sync_state' ? 'crm_account' : 'id').range(offset, offset + 499)); rows.push(...(page ?? [])); if (!page || page.length < 500) return rows; offset += 500; }
}
export const chunks = <T>(items: T[], size = 100): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
export class CrmWriter {
  stats = { negocios: 0, produtos: 0, parcelas: 0, leads: 0 };
  constructor(public db: SupabaseClient, public api: PipedriveClient, public account: string, public cursors: Row) {}
  async upsert(table: string, rows: Row[], key = 'crm_account,pd_id') {
    for (const batch of chunks(rows, 100)) await checked(this.db.from(table).upsert(batch, { onConflict: key }));
  }
  async product(p: Row, kind = 'product', parent?: number) {
    const price = p.prices?.[0] ?? {};
    await this.upsert('crm_products', [{ crm_account: this.account, kind, pd_id: p.id, parent_pd_id: parent ?? null, name: p.name ?? 'Sem nome', code: p.code ?? null, list_price: price.price ?? p.price ?? null, currency: price.currency ?? p.currency ?? null, is_active: p.is_active ?? p.active_flag ?? true, is_deleted: p.is_deleted ?? false, synced_at: new Date().toISOString() }], 'crm_account,kind,pd_id');
  }
  async catalog(table: string, data: Row[], map: (r: Row) => Row, key = 'crm_account,pd_id', scope: Row = {}) {
    const existing = await allRows(this.db, table, this.account);
    await this.upsert(table, data.map(r => ({ crm_account: this.account, ...map(r), synced_at: new Date().toISOString() })), key);
    const received = new Set(data.map(r => String(r.id)));
    const absent = existing.filter(r => Object.entries(scope).every(([k,v]) => r[k] === v) && !received.has(String(r.pd_id)));
    for (const batch of chunks(absent)) if (batch.length) await checked(this.db.from(table).update(table === 'crm_users' ? { is_active: false } : { is_deleted: true }).in('id', batch.map(r => r.id)).eq('crm_account', this.account));
  }
  async structure(configs: Row[]) {
    const pipelines = await this.api.all('/api/v2/pipelines');
    await this.catalog('crm_pipelines', pipelines, p => ({ pd_id: p.id, name: p.name ?? 'Sem nome', order_nr: p.order_nr, is_active: p.is_active ?? p.active ?? true, is_deleted: p.is_deleted ?? false }));
    const stages = await this.api.all('/api/v2/stages');
    await this.catalog('crm_stages', stages, s => ({ pd_id: s.id, pipeline_pd_id: scalarId(s.pipeline_id), name: s.name ?? 'Sem nome', order_nr: s.order_nr, deal_probability: s.deal_probability, days_to_rotten: s.days_to_rotten, is_deleted: s.is_deleted ?? false }));
    const users = await this.api.all('/api/v1/users');
    await this.catalog('crm_users', users, u => ({ pd_id: u.id, name: u.name, is_active: Boolean(u.active_flag) }));
    const products = await this.api.all('/api/v2/products');
    for (const p of products) await this.product(p);
    const existing = await allRows(this.db, 'crm_products', this.account);
    for (const old of existing.filter(p => p.kind === 'product' && !products.some(r => r.id === p.pd_id))) await checked(this.db.from('crm_products').update({ is_deleted: true }).eq('crm_account', this.account).or(`id.eq.${old.id},parent_pd_id.eq.${old.pd_id}`));
    for (const p of products.filter(p => !p.is_deleted && configs.some(c => matchesTerm(p, c.product_term)))) await this.variations(p.id);
    this.cursors.structure_at = new Date().toISOString();
  }
  async variations(id: number) {
    const variations = await this.api.all(`/api/v2/products/${id}/variations`);
    for (const variation of variations) await this.product(variation, 'variation', id);
    const existing = await checked(this.db.from('crm_products').select('id,pd_id').eq('crm_account', this.account).eq('kind','variation').eq('parent_pd_id', id));
    for (const old of existing ?? []) if (!variations.some(v => v.id === old.pd_id)) await checked(this.db.from('crm_products').update({ is_deleted: true }).eq('id',old.id));
  }
  async history(deal: Row, from: number | null, to: number, changed: unknown, source: string) {
    const at = iso(changed) ?? deal.stage_changed_at ?? deal.created_at_source;
    if (!at) throw new PipedriveError('Negócio sem data válida para o histórico de etapa', 422);
    await checked(this.db.from('deal_stage_history').upsert({ crm_account: this.account, deal_id: deal.id, from_stage_pd_id: from, to_stage_pd_id: to, changed_at: at, source }, {onConflict:'deal_id,to_stage_pd_id,changed_at',ignoreDuplicates:true}));
  }
  async deal(d: Row, source = 'sync', change?: Row): Promise<Row> {
    const old = await checked(this.db.from('deals').select('*').eq('crm_account', this.account).eq('pipedrive_deal_id', String(d.id)).maybeSingle());
    const stageId = scalarId(d.stage_id); const ownerId = scalarId(d.owner_id ?? d.user_id);
    const stage = stageId ? await checked(this.db.from('crm_stages').select('name').eq('crm_account',this.account).eq('pd_id',stageId).maybeSingle()) : null;
    const owner = ownerId ? await checked(this.db.from('crm_users').select('name').eq('crm_account',this.account).eq('pd_id',ownerId).maybeSingle()) : null;
    const row = { crm_account: this.account, pipedrive_deal_id: String(d.id), pipeline_pd_id: scalarId(d.pipeline_id), title: d.title, value: d.value, currency: d.currency, stage_id: stageId ? String(stageId) : null, stage_name: stage?.name ?? null, status: ['open','won','lost'].includes(d.status) ? d.status : null, owner_pd_id: ownerId, owner_name: owner?.name ?? null, org_pd_id: scalarId(d.org_id), person_pd_id: scalarId(d.person_id), created_at_source: iso(d.add_time), won_at: iso(d.won_time), lost_at: iso(d.lost_time), stage_changed_at: iso(d.stage_change_time), expected_close_date: d.expected_close_date || null, probability: d.probability, lost_reason: d.lost_reason, label_ids: labels(d.label_ids ?? d.label), products_count: d.products_count ?? 0, activities_count: d.activities_count ?? 0, next_activity_id: scalarId(d.next_activity_id), custom_fields: { ...(customFields(d) ?? {}), __channel: d.channel ?? null, __channel_id: d.channel_id ?? null, __origin: d.origin ?? null }, updated_at_source: iso(d.update_time), is_deleted: d.status === 'deleted' || d.is_deleted === true, synced_at: new Date().toISOString() };
    const saved = await checked(this.db.from('deals').upsert(row, { onConflict: 'crm_account,pipedrive_deal_id' }).select().single());
    if (!saved) throw new PipedriveError('Não foi possível guardar o negócio',500);
    if (stageId && (!old || String(old.stage_id) !== String(stageId))) await this.history(saved, old ? scalarId(old.stage_id) : null, stageId, change?.timestamp ?? d.stage_change_time ?? d.add_time, source);
    else if (stageId && change?.previous_stage_id !== undefined && scalarId(change.previous_stage_id) !== stageId) await this.history(saved, scalarId(change.previous_stage_id), stageId, change.timestamp, source);
    this.stats.negocios++; return saved;
  }
  async replaceLines(table: string, deals: Row[], rows: Row[], mapper: (r: Row, deal: Row) => Row) {
    const byId = new Map(deals.map(d => [String(d.pipedrive_deal_id), d]));
    if (rows.some(r => !byId.has(String(r.deal_id)) || !scalarId(r.id))) throw new PipedriveError('Pipedrive devolveu linhas sem negócio ou identificação',422);
    await this.upsert(table, rows.map(r => mapper(r, byId.get(String(r.deal_id)) ?? {})));
    for (const deal of deals) {
      const received = new Set(rows.filter(r => String(r.deal_id) === deal.pipedrive_deal_id).map(r => String(r.id)));
      const old = await checked(this.db.from(table).select('id,pd_id').eq('crm_account',this.account).eq('deal_id',deal.id));
      for (const batch of chunks((old ?? []).filter(r => !received.has(String(r.pd_id))))) if (batch.length) await checked(this.db.from(table).delete().eq('crm_account',this.account).in('id',batch.map(r => r.id)));
    }
  }
  async products(deals: Row[]) {
    for (const batch of chunks(deals)) {
      const rows = await this.api.all('/api/v2/deals/products', { deal_ids: batch.map(d => d.pipedrive_deal_id).join(',') });
      await this.replaceLines('deal_products',batch,rows,(r,d) => ({ crm_account:this.account,deal_id:d.id,pd_id:r.id, product_pd_id:scalarId(r.product_id),variation_pd_id:scalarId(r.product_variation_id ?? r.variation_id),name:r.name,comments:r.comments,quantity:r.quantity ?? 1,item_price:r.item_price ?? 0,discount:r.discount ?? 0,discount_type:r.discount_type,sum:r.sum ?? 0,currency:r.currency,is_enabled:r.is_enabled ?? r.enabled_flag ?? true,synced_at:new Date().toISOString() }));
      this.stats.produtos += rows.length;
    }
  }
  async installments(deals: Row[]) {
    for (const batch of chunks(deals)) {
      let path = this.cursors.installments_api ?? '/api/v2/deals/installments'; let rows: Row[];
      try { rows = await this.api.all(path,{deal_ids:batch.map(d => d.pipedrive_deal_id).join(',')}); }
      catch(e) { if (!(e instanceof PipedriveError) || e.providerStatus !== 404 || path !== '/api/v2/deals/installments') throw e; path = '/api/v1/deals/installments'; rows = await this.api.all(path,{deal_ids:batch.map(d => d.pipedrive_deal_id).join(',')}); }
      this.cursors.installments_api = path;
      await this.replaceLines('deal_installments',batch,rows,(r,d) => ({crm_account:this.account,deal_id:d.id,pd_id:r.id,deal_product_pd_id:scalarId(r.deal_product_id),amount:r.amount ?? 0,billing_date:r.billing_date || null,description:r.description ?? null,synced_at:new Date().toISOString()}));
      this.stats.parcelas += rows.length;
    }
  }
  async related(deals: Row[]) {
    const orgs = [...new Set(deals.map(d => d.org_pd_id).filter(Boolean))];
    for (const batch of chunks(orgs)) { const rows = await this.api.all('/api/v2/organizations',{ids:batch.join(',')}); for (const r of rows) await this.organization(r); }
    const people = [...new Set(deals.map(d => d.person_pd_id).filter(Boolean))];
    for (const batch of chunks(people)) { const rows = await this.api.all('/api/v2/persons',{ids:batch.join(',')}); for (const r of rows) await checked(this.db.from('deals').update({person_name:r.name ?? null}).eq('crm_account',this.account).eq('person_pd_id',r.id)); }
    for (const d of deals) if (!d.org_pd_id || !d.person_pd_id) await checked(this.db.from('deals').update({ ...(!d.org_pd_id ? {org_name:null} : {}), ...(!d.person_pd_id ? {person_name:null} : {}) }).eq('id',d.id).eq('crm_account',this.account));
  }
  async organization(r: Row) {
    await this.upsert('crm_organizations',[{crm_account:this.account,pd_id:r.id,name:r.name,custom_fields:customFields(r),is_deleted:r.is_deleted ?? false,updated_at_source:iso(r.update_time),synced_at:new Date().toISOString()}]);
    await checked(this.db.from('deals').update({org_name:r.name ?? null}).eq('crm_account',this.account).eq('org_pd_id',r.id));
  }
  async hydrate(deals: Row[]) {
    const withProducts = deals.filter(d => d.products_count > 0 && !d.is_deleted);
    if (withProducts.length) { await this.products(withProducts); await this.installments(withProducts); }
    for (const d of deals.filter(d => d.products_count === 0 || d.is_deleted)) for (const table of ['deal_products','deal_installments']) await checked(this.db.from(table).delete().eq('crm_account',this.account).eq('deal_id',d.id));
    await this.related(deals.filter(d => !d.is_deleted));
  }
  async lead(r: Row, archived = false) {
    const ownerId=scalarId(r.owner_id); const orgId=scalarId(r.organization_id);
    const owner=ownerId ? await checked(this.db.from('crm_users').select('name').eq('crm_account',this.account).eq('pd_id',ownerId).maybeSingle()) : null;
    const org=orgId ? await checked(this.db.from('crm_organizations').select('name').eq('crm_account',this.account).eq('pd_id',orgId).maybeSingle()) : null;
    await this.upsert('crm_leads',[{crm_account:this.account,pd_lead_id:String(r.id),title:r.title,org_pd_id:orgId,org_name:org?.name ?? null,person_pd_id:scalarId(r.person_id),owner_pd_id:ownerId,owner_name:owner?.name ?? null,label_ids:labels(r.label_ids),source_name:r.source_name ?? null,is_archived:archived || r.is_archived === true,expected_close_date:r.expected_close_date || null,added_at:iso(r.add_time),updated_at_source:iso(r.update_time),custom_fields:customFields(r),synced_at:new Date().toISOString()}],'crm_account,pd_lead_id'); this.stats.leads++;
  }
}
export async function saveRate(db: SupabaseClient,account:string,api:PipedriveClient,cursors:Row, extra:Row={}) {
  const current=await checked(db.from('crm_sync_state').select('cursors,tokens_day,tokens_used_today').eq('crm_account',account).maybeSingle());
  const day=new Date().toISOString().slice(0,10); const rate=api.rate.limit !== undefined ? api.rate : current?.cursors?.rate;
  const merged={...(current?.cursors??{}),...cursors,...(rate?{rate}: {})};
  if(Object.hasOwn(cursors,'work') && cursors.work===null)delete merged.work;
  await checked(db.from('crm_sync_state').upsert({crm_account:account,cursors:merged,tokens_day:day,tokens_used_today:rate?.limit!==undefined?Math.max(0,rate.limit-rate.remaining):current?.tokens_day===day?current.tokens_used_today:0,...extra},{onConflict:'crm_account'}));
}
export function errorResponse(e: unknown) { return json({error:e instanceof PipedriveError ? e.message : 'Não foi possível concluir a operação do CRM'},e instanceof PipedriveError?e.status:500); }
