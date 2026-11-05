import { z } from 'npm:zod@3';
import { checked, configsFor, constantEqual, CrmWriter, errorResponse, json, PipedriveClient, PipedriveError, pipelineIds, preflight, resolveToken, saveRate, scalarId, serverClient, accountDomain, type Row } from '../_shared/pipedrive.ts';
const envelope=z.object({meta:z.object({version:z.literal('2.0'),action:z.enum(['create','change','delete']),entity:z.string().max(64),entity_id:z.union([z.string().min(1).max(100),z.number().int().positive()]),timestamp:z.string().datetime().optional()}).passthrough(),data:z.record(z.unknown()).nullable().optional(),previous:z.record(z.unknown()).nullable().optional()}).passthrough();
const entities=new Set(['deal','deal_product','deal_installment','product','stage','pipeline','organization','lead']);
Deno.serve(async req=>{
  const options=preflight(req);if(options)return options;
  let db;let api:PipedriveClient|undefined;let account:string|undefined;
  const changes:Row={};
  try{
    if(req.method!=='POST')return json({error:'Use uma chamada POST'},405);
    const user=Deno.env.get('PIPEDRIVE_WEBHOOK_USER')??'';const password=Deno.env.get('PIPEDRIVE_WEBHOOK_PASSWORD')??'';
    const auth=req.headers.get('Authorization')??'';let suppliedUser='',suppliedPassword='';
    if(auth.startsWith('Basic ')){try{const decoded=atob(auth.slice(6));const colon=decoded.indexOf(':');if(colon>=0){suppliedUser=decoded.slice(0,colon);suppliedPassword=decoded.slice(colon+1);}}catch{ /* Invalid Basic credentials fail closed. */ }}
    const [validUser,validPassword]=await Promise.all([constantEqual(suppliedUser,user),constantEqual(suppliedPassword,password)]);
    if(!validUser || !validPassword)return json({error:'Não autorizado'},401);
    db=serverClient();account=accountDomain(new URL(req.url).searchParams.get('conta'));
    const configs=await configsFor(db,account,false);if(!configs.length)return json({error:'Conta não cadastrada'},404);
    const raw=await req.json().catch(()=>null);const parsed=envelope.safeParse(raw);
    if(!parsed.success || !entities.has(parsed.data.meta.entity)){
      // Only allowlisted type/action labels; never payloads or arbitrary client strings.
      console.info('pipedrive-webhook: formato ignorado',{tipo:entities.has(raw?.meta?.entity)?raw.meta.entity:'desconhecido',acao:['create','change','delete'].includes(raw?.meta?.action)?raw.meta.action:'desconhecida'});
      return json({ignorado:true});
    }
    const {meta,data,previous}=parsed.data;const id=meta.entity_id;
    if(meta.entity==='lead'?!/^[a-f0-9-]{36}$/i.test(String(id)):!scalarId(id))return json({ignorado:true});
    api=new PipedriveClient(account,await resolveToken(db,account),Date.now()+110000);
    const current=await checked(db.from('crm_sync_state').select('cursors').eq('crm_account',account).maybeSingle());
    const writer=new CrmWriter(db,api,account,{...(current?.cursors??{})});
    const linked=[...new Set(configs.flatMap(pipelineIds))];
    if(meta.entity==='deal'){
      const old=await checked(db.from('deals').select('*').eq('crm_account',account).eq('pipedrive_deal_id',String(id)).maybeSingle());
      if(meta.action==='delete'){
        if(old)await checked(db.from('deals').update({is_deleted:true,synced_at:new Date().toISOString()}).eq('id',old.id).eq('crm_account',account));
      }else{
        const r=(await api.get(`/api/v2/deals/${id}`,{include_fields:'products_count,activities_count,next_activity_id'})).data;
        if(!r)return json({ignorado:true});
        if(!old && !linked.includes(scalarId(r.pipeline_id)??0))return json({ignorado:true});
        const saved=await writer.deal(r,'webhook',{previous_stage_id:previous?.stage_id,timestamp:meta.timestamp});
        await writer.hydrate([saved]);
      }
    }else if(meta.entity==='deal_product' || meta.entity==='deal_installment'){
      const table=meta.entity==='deal_product'?'deal_products':'deal_installments';
      const line=await checked(db.from(table).select('deal_id').eq('crm_account',account).eq('pd_id',Number(id)).maybeSingle());
      const dealId=scalarId(data?.deal_id??previous?.deal_id);
      let query=db.from('deals').select('*').eq('crm_account',account);
      if(dealId)query=query.eq('pipedrive_deal_id',String(dealId));else if(line)query=query.eq('id',line.deal_id);else {console.info('pipedrive-webhook: linha sem negócio',{tipo:meta.entity,acao:meta.action});return json({ignorado:true});}
      let deal=await checked(query.maybeSingle());
      if(!deal && dealId){const r=(await api.get(`/api/v2/deals/${dealId}`,{include_fields:'products_count,activities_count,next_activity_id'})).data;if(r && linked.includes(scalarId(r.pipeline_id)??0))deal=await writer.deal(r,'webhook');}
      if(!deal)return json({ignorado:true});
      if(meta.action==='delete')await checked(db.from(table).delete().eq('crm_account',account).eq('pd_id',Number(id)));
      if(meta.entity==='deal_product')await writer.products([deal]);else await writer.installments([deal]);
    }else if(meta.entity==='product'){
      if(meta.action==='delete')await checked(db.from('crm_products').update({is_deleted:true}).eq('crm_account',account).or(`and(kind.eq.product,pd_id.eq.${Number(id)}),parent_pd_id.eq.${Number(id)}`));
      else {const r=(await api.get(`/api/v2/products/${id}`)).data;if(r){await writer.product(r);await writer.variations(Number(id));}}
    }else if(meta.entity==='stage' || meta.entity==='pipeline'){
      const table=meta.entity==='stage'?'crm_stages':'crm_pipelines';
      if(meta.action==='delete')await checked(db.from(table).update({is_deleted:true}).eq('crm_account',account).eq('pd_id',Number(id)));
      else {
        const r=(await api.get(`/api/v2/${meta.entity==='stage'?'stages':'pipelines'}/${id}`)).data;
        if(r)await writer.upsert(table,[{crm_account:account,pd_id:r.id,name:r.name??'Sem nome',order_nr:r.order_nr,is_deleted:r.is_deleted??false,synced_at:new Date().toISOString(),...(meta.entity==='stage'?{pipeline_pd_id:scalarId(r.pipeline_id),deal_probability:r.deal_probability,days_to_rotten:r.days_to_rotten}:{is_active:r.is_active??r.active??true})}]);
      }
    }else if(meta.entity==='organization'){
      if(meta.action==='delete'){await checked(db.from('crm_organizations').update({is_deleted:true}).eq('crm_account',account).eq('pd_id',Number(id)));await checked(db.from('deals').update({org_name:null}).eq('crm_account',account).eq('org_pd_id',Number(id)));}
      else {const r=(await api.get(`/api/v2/organizations/${id}`)).data;if(r)await writer.organization(r);}
    }else if(meta.entity==='lead'){
      if(meta.action==='delete')await checked(db.from('crm_leads').delete().eq('crm_account',account).eq('pd_lead_id',String(id)));
      else{const r=(await api.get(`/api/v1/leads/${id}`)).data;if(r)await writer.lead(r);}
    }
    changes.last_webhook_at=new Date().toISOString();
    if(writer.cursors.installments_api)changes.installments_api=writer.cursors.installments_api;
    return json({processado:true});
  }catch(e){
    if(e instanceof PipedriveError && e.status===422){console.warn('pipedrive-webhook: dado inválido');return json({ignorado:true});}
    if(e instanceof PipedriveError && (e.status===503 || e.status===500))return json({error:e.message},503);
    return errorResponse(e);
  }finally{
    if(db && api && account)try{await saveRate(db,account,api,changes);}catch{console.error('pipedrive-webhook: falha ao registrar consumo');}
  }
});
