import { beforeAll, describe, expect, it, vi } from 'vitest';
beforeAll(() => {
  // jsdom's AbortSignal does not implement the server runtime timeout helper.
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: () => new AbortController().signal });
});
import { accountDomain, isBusy, matchesTerm, retryDelay, safeFields, type Row } from '../../supabase/functions/_shared/pipedrive-rules';
import { PipedriveClient } from '../../supabase/functions/_shared/pipedrive-client';
const config={event_id:'event-a',product_term:'Edição',pipelines:[{pipeline_pd_id:12}],product_rules:[],stage_groups:{},sales_window_start:'2026-10-01',sales_window_end:'2026-11-30',events:{end_date:'2026-11-30'}};
const deal={id:'deal-a',pipedrive_deal_id:'21',pipeline_pd_id:12,status:'won',won_at:'2026-11-04T12:00:00Z',is_deleted:false};
describe('regras Pipedrive',()=>{
 it('normaliza conta e bloqueia domínio externo',()=>{expect(accountDomain('HTTPS://CUPOLA.pipedrive.com/')).toBe('cupola');expect(()=>accountDomain('evil.example/path')).toThrow();});
 it('compara termos sem acentos e sem diferenciar caixa',()=>{expect(matchesTerm({name:'EDIÇÃO 2027'},'edicao')).toBe(true);expect(matchesTerm({name:'EDIÇÃO'},'')).toBe(false);});
 it('bloqueia execução sobreposta por dez minutos',()=>{const now=Date.parse('2026-11-04T12:00:00Z');expect(isBusy({last_started_at:'2026-11-04T11:51:00Z',last_success_at:'2026-11-04T11:50:00Z'},now)).toBe(true);expect(isBusy({last_started_at:'2026-11-04T11:49:00Z'},now)).toBe(false);});
 it('repetições esperam 2, 4 e 8 segundos e respeitam Retry-After',()=>{expect([0,1,2].map(n=>retryDelay(n,null))).toEqual([2000,4000,8000]);expect(retryDelay(0,'12')).toBe(12000);});
 it('não envia opções de campos de pessoas, usuários ou empresas',()=>{for(const field_type of ['user','people','org'])expect(safeFields([{key:'a',field_type,options:[{id:1,label:'restrito'}]}])[0]).not.toHaveProperty('options');});
});
function reply(status=200,remaining=1000,data:Row={data:[],additional_data:{next_cursor:null}}){return new Response(JSON.stringify(data),{status,headers:{'x-daily-ratelimit-token-limit':'1000','x-daily-ratelimit-token-remaining':String(remaining)}});}
describe('cliente somente leitura',()=>{
 it('só usa GET, nunca token na URL, intervalo mínimo de 50ms',async()=>{const clock=vi.spyOn(Date,'now').mockReturnValue(1000000);try{const request=vi.fn(async(..._args:Parameters<typeof fetch>)=>reply());const wait=vi.fn(async(_ms:number)=>{});const client=new PipedriveClient('cupola','fixture',Infinity,request,wait);await client.get('/api/v2/deals');await client.get('/api/v2/deals');expect(request.mock.calls.every(call=>call[1]?.method==='GET')).toBe(true);expect(String(request.mock.calls[0]?.[0])).not.toContain('fixture');expect(wait.mock.calls[1][0]).toBe(50);}finally{clock.mockRestore();}});
 it('faz no máximo três novas tentativas em 429',async()=>{const request=vi.fn(async()=>reply(429,0));const wait=vi.fn(async(_ms:number)=>{});const client=new PipedriveClient('cupola','fixture',Infinity,request,wait);await expect(client.get('/api/v2/deals')).rejects.toThrow('Limite diário');expect(request).toHaveBeenCalledTimes(4);expect(wait.mock.calls.map(c=>c[0]).filter(n=>n>=2000)).toEqual([2000,4000,8000]);});
 it('para novas leituras abaixo de cinco por cento',async()=>{const request=vi.fn(async()=>reply(200,49));const client=new PipedriveClient('cupola','fixture',Infinity,request,async()=>{});await client.get('/api/v2/deals');await expect(client.get('/api/v2/deals')).rejects.toThrow('abaixo de 5%');expect(request).toHaveBeenCalledTimes(1);});
 it('pagina v2 por cursor sem perder a segunda página',async()=>{const request=vi.fn().mockResolvedValueOnce(reply(200,900,{data:[{id:1}],additional_data:{next_cursor:'next'}})).mockResolvedValueOnce(reply(200,800,{data:[{id:2}],additional_data:{next_cursor:null}}));const client=new PipedriveClient('cupola','fixture',Infinity,request,async()=>{});expect(await client.all('/api/v2/deals')).toEqual([{id:1},{id:2}]);expect(String(request.mock.calls[1][0])).toContain('cursor=next');});
 it('pagina v1 por start',async()=>{const request=vi.fn().mockResolvedValueOnce(reply(200,900,{data:[{id:1}],additional_data:{pagination:{more_items_in_collection:true,next_start:500}}})).mockResolvedValueOnce(reply(200,800,{data:[],additional_data:{pagination:{more_items_in_collection:false}}}));const client=new PipedriveClient('cupola','fixture',Infinity,request,async()=>{});expect(await client.all('/api/v1/leads')).toHaveLength(1);expect(String(request.mock.calls[1][0])).toContain('start=500');});
 it('não expõe corpo bruto de erro do provedor',async()=>{const request=vi.fn(async()=>new Response('conteúdo privado',{status:401}));const client=new PipedriveClient('cupola','fixture',Infinity,request,async()=>{});await expect(client.get('/api/v2/deals')).rejects.toThrow('Pipedrive respondeu 401: token inválido ou sem permissão');});
});
