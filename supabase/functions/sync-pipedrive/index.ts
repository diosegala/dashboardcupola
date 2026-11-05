import { z } from 'npm:zod@3';
import { authorize, checked, configsFor, CrmWriter, errorResponse, json, PartialRun, PipedriveClient, PipedriveError, pipelineIds, preflight, resolveToken, saveRate, serverClient, type Row } from '../_shared/pipedrive.ts';
import { isBusy, LOW_RATE_MESSAGE, matchesTerm, scalarId } from '../_shared/pipedrive-rules.ts';
const schema=z.object({crm_account:z.string().min(1).max(100).optional(),full:z.boolean().optional(),scheduled_at:z.string().datetime().optional()}).strict();
async function runAccount(db:ReturnType<typeof serverClient>, account:string, configs:Row[], full:boolean, deadline:number) {
  const state=await checked(db.from('crm_sync_state').select('*').eq('crm_account',account).maybeSingle());
  if(isBusy(state)) return {account,aviso:'sincronização já em andamento'};
  const started=new Date().toISOString(); const cursors={...(state?.cursors??{})};
  const previousStart=state?.last_started_at??null;
  if(state){let q=db.from('crm_sync_state').update({last_started_at:started,last_error:null}).eq('crm_account',account); q=previousStart?q.eq('last_started_at',previousStart):q.is('last_started_at',null); const rows=await checked(q.select('crm_account')); if(!rows?.length)return {account,aviso:'sincronização já em andamento'};}
  else {const {error}=await db.from('crm_sync_state').insert({crm_account:account,last_started_at:started,cursors:{}}); if(error?.code==='23505')return {account,aviso:'sincronização já em andamento'}; if(error)throw new PipedriveError('Não foi possível iniciar a sincronização',500);}
  let api:PipedriveClient|undefined;
  try {
    api=new PipedriveClient(account,await resolveToken(db,account),deadline);
    const writer=new CrmWriter(db,api,account,cursors);
    let work=full?undefined:cursors.work;
    if(!work){
      const startDates=configs.map(c=>c.sales_window_start).filter(Boolean).sort();
      const fallback=new Date(); fallback.setUTCMonth(fallback.getUTCMonth()-18);
      work={started,structure:full || !cursors.structure_at || Date.now()-Date.parse(cursors.structure_at)>86400000,phase:'structure',step:0,seen:[],pipeline:0,mode:0,since:(cursors.deals&&!full?new Date(Date.parse(cursors.deals)-120000).toISOString():new Date(`${startDates[0]??fallback.toISOString().slice(0,10)}T00:00:00Z`).toISOString()).replace(/\.\d{3}Z$/,'Z'),initial:!cursors.deals,pipelines:[...new Set(configs.flatMap(pipelineIds))],pending:[],leadMode:0}; cursors.work=work;
    }
    const checkpoint=async()=>saveRate(db,account,api as PipedriveClient,cursors);
    const guard=()=>{if(Date.now()>deadline-10000)throw new PartialRun(); if(api && api.rate.limit>0 && api.rate.remaining<api.rate.limit*.05)throw new PipedriveError(LOW_RATE_MESSAGE,503,429);};
    // Cursor is advanced only after every row and associated data in the page is durable.
    const catalogSteps=[
      {table:'crm_pipelines',path:'/api/v2/pipelines',map:(r:Row)=>({pd_id:r.id,name:r.name??'Sem nome',order_nr:r.order_nr,is_active:r.is_active??r.active??true,is_deleted:r.is_deleted??false})},
      {table:'crm_stages',path:'/api/v2/stages',map:(r:Row)=>({pd_id:r.id,pipeline_pd_id:scalarId(r.pipeline_id),name:r.name??'Sem nome',order_nr:r.order_nr,deal_probability:r.deal_probability,days_to_rotten:r.days_to_rotten,is_deleted:r.is_deleted??false})},
      {table:'crm_users',path:'/api/v1/users',map:(r:Row)=>({pd_id:r.id,name:r.name,is_active:Boolean(r.active_flag)})},
      {table:'crm_products',path:'/api/v2/products',map:(r:Row)=>({pd_id:r.id,kind:'product',name:r.name??'Sem nome',code:r.code,list_price:r.prices?.[0]?.price??null,currency:r.prices?.[0]?.currency??null,is_active:r.is_active??r.active_flag??true,is_deleted:r.is_deleted??false})},
    ];
    while(work.phase==='structure'){
      guard();
      if(!work.structure){work.phase='deals';await checkpoint();break;}
      if(work.step<catalogSteps.length){
        const step=catalogSteps[work.step]; const page=await api.page(step.path,{},work.cursor);
        await writer.upsert(step.table,page.rows.map(r=>({crm_account:account,...step.map(r),synced_at:new Date().toISOString()})),step.table==='crm_products'?'crm_account,kind,pd_id':'crm_account,pd_id');
        work.seen=[...new Set([...work.seen,...page.rows.map(r=>r.id)])];
        if(page.next!==undefined){work.cursor=page.next;await checkpoint();continue;}
        // Complete snapshot, then tombstone omitted rows. Never on a partial snapshot.
        const old=await import('../_shared/pipedrive.ts').then(m=>m.allRows(db,step.table,account));
        for(const r of old.filter(r=>(step.table!=='crm_products'||r.kind==='product') && !work.seen.includes(r.pd_id)))await checked(db.from(step.table).update(step.table==='crm_users'?{is_active:false}:{is_deleted:true}).eq('id',r.id));
        work.step++;delete work.cursor;work.seen=[];await checkpoint();
      }else{
        const products=await import('../_shared/pipedrive.ts').then(m=>m.allRows(db,'crm_products',account));
        const selected=products.filter(p=>p.kind==='product' && !p.is_deleted && configs.some(c=>matchesTerm(p,c.product_term))).sort((a,b)=>a.pd_id-b.pd_id);
        const product=selected.find(p=>p.pd_id>(work.lastVariationProduct??0));
        if(product){const page=await api.page(`/api/v2/products/${product.pd_id}/variations`,{},work.cursor);for(const r of page.rows)await writer.product(r,'variation',product.pd_id);work.seen=[...new Set([...work.seen,...page.rows.map(r=>r.id)])];if(page.next!==undefined)work.cursor=page.next;else{for(const old of products.filter(p=>p.kind==='variation'&&p.parent_pd_id===product.pd_id&&!work.seen.includes(p.pd_id)))await checked(db.from('crm_products').update({is_deleted:true}).eq('id',old.id));work.lastVariationProduct=product.pd_id;work.seen=[];delete work.cursor;}await checkpoint();}
        else{cursors.structure_at=new Date().toISOString();work.phase='deals';delete work.cursor;await checkpoint();}
      }
    }
    while(work.phase==='deals'){
      guard();
      if(work.pending?.length){
        const ids=work.pending.slice(0,100);const deals=await checked(db.from('deals').select('*').eq('crm_account',account).in('pipedrive_deal_id',ids));
        await writer.hydrate(deals??[]);work.pending=work.pending.slice(100);await checkpoint();continue;
      }
      if(work.pageDone){delete work.pageDone;if(work.nextCursor!==undefined && work.nextCursor!==null)work.cursor=work.nextCursor;else{delete work.cursor;work.mode++;}delete work.nextCursor;await checkpoint();}
      if(work.pipeline>=work.pipelines.length){work.phase=work.pipelines.length?'leads':'pending';await checkpoint();break;}
      const modes=work.initial?['open','all','deleted']:['all','deleted'];
      if(work.mode>=modes.length){work.pipeline++;work.mode=0;await checkpoint();continue;}
      const mode=modes[work.mode];
      const page=await api.page('/api/v2/deals',{pipeline_id:work.pipelines[work.pipeline],...(mode!=='all'?{status:mode}:{}),...(mode!=='open'?{updated_since:String(work.since).replace(/\.\d{3}Z$/,'Z')}:{}),include_fields:'products_count,activities_count,next_activity_id',limit:100},work.cursor);
      // Stops before the next write; cursor stays on this page so replay is idempotent.
      const saved:Row[]=[];for(const r of page.rows){guard();saved.push(await writer.deal(mode==='deleted'?{...r,status:'deleted'}:r));}
      work.pending=saved.map(d=>d.pipedrive_deal_id);work.pageDone=true;work.nextCursor=page.next??null;await checkpoint();
    }
    while(work.phase==='leads'){
      guard(); if(work.leadMode>1){work.phase='pending';delete work.cursor;await checkpoint();break;}
      const page=await api.page(work.leadMode===0?'/api/v1/leads':'/api/v1/leads/archived',{},work.cursor);
      for(const r of page.rows)await writer.lead(r,work.leadMode===1);
      if(page.next!==undefined)work.cursor=page.next;else{delete work.cursor;work.leadMode++;}await checkpoint();
    }
    guard();
    if(work.pipelines.length)cursors.deals=work.started;
    cursors.work=null;
    await saveRate(db,account,api,cursors,{last_success_at:new Date().toISOString(),last_error:null});
    return {account,...writer.stats,rate:api.rate};
  }catch(e){
    if(e instanceof PartialRun){if(api)await saveRate(db,account,api,cursors,{last_started_at:null,last_error:null});return {account,parcial:true,rate:api?.rate??{}};}
    const error=e instanceof PipedriveError?e.message:'Erro ao sincronizar os dados do CRM';
    if(api)await saveRate(db,account,api,cursors,{last_started_at:null,last_error:error});else await checked(db.from('crm_sync_state').update({last_started_at:null,last_error:error}).eq('crm_account',account));
    return {account,error,rate:api?.rate??{}};
  }
}
Deno.serve(async req=>{
  const options=preflight(req);if(options)return options;
  let db;
  try{
    db=serverClient();await authorize(req,db,true);
    const parsed=schema.safeParse(await req.json().catch(()=>({})));if(!parsed.success)return json({error:'Parâmetros inválidos para sincronizar o CRM'},400);
    const configs=await configsFor(db,parsed.data.crm_account);
    if(!configs.length)return json({error:'Nenhuma conta do Pipedrive vinculada a evento ativo'},400);
    const integration=await checked(db.from('integrations').select('is_active').eq('name','pipedrive').maybeSingle());
    if(!integration?.is_active)return json({error:'Ative a integração Pipedrive antes de sincronizar'},400);
    await checked(db.from('integrations').update({sync_status:'syncing',error_message:null}).eq('name','pipedrive'));
    const results:Row[]=[];const deadline=Date.now()+110000;
    for(const account of [...new Set(configs.map(c=>c.crm_account))]){
      if(Date.now()>deadline-10000){results.push({account,parcial:true});continue;}
      results.push(await runAccount(db,account,configs.filter(c=>c.crm_account===account),parsed.data.full??false,deadline));
    }
    const errors=results.filter(r=>r.error).map(r=>r.error);
    const busy=results.some(r=>r.aviso==='sincronização já em andamento');
    await checked(db.from('integrations').update(errors.length?{sync_status:'error',error_message:errors.join('; ')}:busy?{sync_status:'syncing'}:{sync_status:'idle',error_message:null,...(!results.some(r=>r.parcial)?{last_synced_at:new Date().toISOString()}: {})}).eq('name','pipedrive'));
    return json({contas:results,...(results.some(r=>r.parcial)?{parcial:true}: {})},errors.length?502:200);
  }catch(e){return errorResponse(e);}
});
