import { z } from 'npm:zod@3';
import { authorize, errorResponse, json, matchesTerm, PipedriveClient, PipedriveError, preflight, resolveAccount, resolveToken, saveRate, serverClient } from '../_shared/pipedrive.ts';
import { LOW_RATE_MESSAGE, safeFields, type Row } from '../_shared/pipedrive-rules.ts';
const schema=z.object({event_id:z.string().uuid().optional(),crm_account:z.string().min(1).max(100).optional(),product_term:z.string().max(255).optional()}).strict().refine(v=>v.event_id || v.crm_account);
Deno.serve(async req=>{
  const options=preflight(req); if(options) return options;
  let api:PipedriveClient|undefined; let account:string|undefined; let db;
  try {
    db=serverClient(); await authorize(req,db);
    const parsed=schema.safeParse(await req.json().catch(()=>null));
    if(!parsed.success) return json({error:'Informe event_id válido ou crm_account, e product_term opcional'},400);
    account=await resolveAccount(db,parsed.data); api=new PipedriveClient(account,await resolveToken(db,account),Date.now()+110000);
    const pick=(r:Row,keys:string[])=>Object.fromEntries(keys.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
    const pipelines=(await api.all('/api/v2/pipelines')).map(r=>pick(r,['id','name','order_nr','is_deleted']));
    const stages=(await api.all('/api/v2/stages')).map(r=>pick(r,['id','pipeline_id','name','order_nr','deal_probability','days_to_rotten']));
    const products:Row[]=(await api.all('/api/v2/products')).map(r=>({...pick(r,['id','name','code','is_deleted']),prices:(r.prices??[]).slice(0,1).map((p:Row)=>pick(p,['price','currency']))}));
    const variations:Row[]=[];
    for(const product of products.filter(p=>matchesTerm(p,parsed.data.product_term))) for(const v of await api.all(`/api/v2/products/${product.id}/variations`)) variations.push({...pick(v,['id','name','code','price','currency','is_deleted']),product_id:product.id});
    const deal_fields=safeFields(await api.all('/api/v1/dealFields'));
    const organization_fields=safeFields(await api.all('/api/v1/organizationFields'));
    const users=(await api.all('/api/v1/users')).map(r=>pick(r,['id','name','active_flag']));
    if(api.rate.limit>0 && api.rate.remaining<api.rate.limit*.05) throw new PipedriveError(LOW_RATE_MESSAGE,503,429);
    return json({pipelines,stages,products,variations,deal_fields,organization_fields,users,account:{domain:account,rate:api.rate}});
  }catch(e){return errorResponse(e);} finally{if(db && api && account) try{await saveRate(db,account,api,{});}catch{console.error('list-crm-options: erro ao registrar consumo');}}
});
