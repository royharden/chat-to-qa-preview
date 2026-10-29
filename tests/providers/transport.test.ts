import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {verifyRedacted,isRedactedSession,RULES_VERSION} from '../../src/lib/redactkit/index.ts';
import {buildModelInput} from '../../src/lib/select/modelInput.ts';
import type {RedactedRequest} from '../../src/lib/select/modelInput.ts';
import type {LiveContext} from '../../src/lib/providers/types.ts';
import type {Ledger,LedgerRow} from '../../src/lib/callledger/ledger.ts';
import {completeLive} from '../../src/lib/providers/anthropic.ts';
import {PRICES} from '../../src/lib/callledger/prices.ts';

/** A test-only dependency replacement: production PRICES remains the untouched empty array. */
vi.mock('../../src/lib/callledger/prices.ts',async importOriginal=>{
 const original=await importOriginal<typeof import('../../src/lib/callledger/prices.ts')>();
 return {...original,approvedPrice:vi.fn((provider:'anthropic'|'openai',model:string)=>({
 provider,model,input_per_million:1,output_per_million:2,verified:Boolean(1),verified_at:new Date(0).toISOString(),
 }))};
});
async function requestFixture():Promise<RedactedRequest>{
 const session=await verifyRedacted([{id:'t1',role:'user',text:'How can I set mode safe?'},{id:'t2',role:'assistant',text:'Set mode safe.'}],RULES_VERSION);
 if(!isRedactedSession(session))throw new Error('synthetic_session_not_redacted');
 const selection=buildModelInput(session);if(!selection.ok)throw new Error('synthetic_pair_not_selected');return selection.request;
}
function candidate(request:RedactedRequest){
 const question=request.turns.find(t=>t.id===request.pair.user_turn_id)!,answer=request.turns.find(t=>t.id===request.pair.assistant_turn_id)!;
 const block=(turn:typeof question)=>({kind:'sentence',text:turn.text,spans:[{turn_id:turn.id,start:0,end:turn.text.length,source_revision:request.source_revision}]});
 return {source_revision:request.source_revision,question:block(question),answer:[block(answer)]};
}
function response(request:RedactedRequest,usage:unknown={input_tokens:10,output_tokens:5},valid=true):Response{
 const output=valid?candidate(request):{...candidate(request),answer:[]};
 return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(output)}],...(usage===undefined?{}:{usage})}),{status:200,headers:{'Content-Type':'application/json'}});
}
function harness(){
 const rows:LedgerRow[]=[],events:string[]=[];
 const reserve=vi.fn(async(row:LedgerRow)=>{events.push('reserve');rows.push(row);});
 const settle=vi.fn(async(_id:string,_status:'settled'|'failed'|'timeout',_usd:number,_usage:unknown|null,_latency:number)=>{events.push('settle');});
 const ledger:Ledger={reserve,settle};
 const context:LiveContext={apiKey:['fixture',crypto.randomUUID()].join('-'),model:'synthetic-model',request_id:crypto.randomUUID(),run_id:'transport-test',operator_id:crypto.randomUUID(),ledger,confirmProviderSend:true};
 return {context,rows,events,reserve,settle};
}
describe('offline provider transport behavior',()=>{
 beforeEach(()=>{vi.clearAllMocks();for(const name of ['log','error','warn','info','debug'] as const)vi.spyOn(console,name).mockImplementation(()=>{});});
 afterEach(()=>{
 for(const name of ['log','error','warn','info','debug'] as const)expect(console[name]).not.toHaveBeenCalled();
 vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();
 });
 it('awaits reservation before one transport and settles valid reported usage',async()=>{
 const request=await requestFixture(),h=harness();let release:(()=>void)|undefined;
 h.reserve.mockImplementation(async row=>{h.events.push('reserve_started');h.rows.push(row);await new Promise<void>(resolve=>{release=resolve;});h.events.push('reserved');});
 const transport=vi.fn(async()=>{h.events.push('transport');return response(request);});vi.stubGlobal('fetch',transport);
 const resultPromise=completeLive('anthropic',request,h.context);
 await vi.waitFor(()=>expect(h.reserve).toHaveBeenCalledOnce());expect(transport).not.toHaveBeenCalled();
 release!();const result=await resultPromise;
 expect(result.ok).toBe(true);expect(transport).toHaveBeenCalledOnce();expect(h.events).toEqual(['reserve_started','reserved','transport','settle']);
 expect(h.settle).toHaveBeenCalledWith(h.context.request_id,'settled',0.00002,{input_tokens:10,output_tokens:5},expect.any(Number));
 const args=transport.mock.calls[0] as unknown as [string,RequestInit];
 expect(args[0]).toBe('https://api.anthropic.com/v1/messages');expect(args[1]).toMatchObject({method:'POST',redirect:'error'});
 expect(JSON.stringify(h.rows[0])).not.toContain(request.turns[0]!.text);expect(JSON.stringify(h.rows[0])).not.toContain(h.context.apiKey);
 expect(PRICES).toEqual([]);
 });
 it.each(['duplicate_request_id','budget_exceeded'])('makes zero calls when reservation refuses: %s',async reason=>{
 const request=await requestFixture(),h=harness(),transport=vi.fn();vi.stubGlobal('fetch',transport);
 h.reserve.mockRejectedValue(new Error(reason));
 expect(await completeLive('anthropic',request,h.context)).toEqual({ok:false,reason:'reservation_refused'});
 expect(transport).not.toHaveBeenCalled();expect(h.settle).not.toHaveBeenCalled();
 });
 it('charges the full reservation for malformed output with no retry',async()=>{
 const request=await requestFixture(),h=harness(),transport=vi.fn(async()=>response(request,{input_tokens:10,output_tokens:5},false));vi.stubGlobal('fetch',transport);
 expect(await completeLive('anthropic',request,h.context)).toEqual({ok:false,reason:'provider_or_schema_failure'});
 expect(transport).toHaveBeenCalledOnce();expect(h.settle).toHaveBeenCalledWith(h.context.request_id,'failed',h.rows[0]!.reserved_usd,null,expect.any(Number));
 });
 it('keeps the full reservation when valid output omits usage',async()=>{
 const request=await requestFixture(),h=harness();
 // Explicit envelope omission avoids passing a defaulted argument as a fake missing-usage test.
 const transport=vi.fn(async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(candidate(request))}]}),{status:200}));vi.stubGlobal('fetch',transport);
 const result=await completeLive('anthropic',request,h.context);
 expect(result.ok).toBe(true);if(result.ok)expect(result.usage).toBeNull();
 expect(transport).toHaveBeenCalledOnce();expect(h.settle).toHaveBeenCalledWith(h.context.request_id,'settled',h.rows[0]!.reserved_usd,null,expect.any(Number));
 });
 it('aborts at the timeout, consumes the full reservation and never retries',async()=>{
 const request=await requestFixture(),h=harness();vi.useFakeTimers();
 const transport=vi.fn((_url:unknown,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
 const signal=init.signal!;signal.addEventListener('abort',()=>reject(new DOMException('synthetic timeout','AbortError')),{once:true});
 }));vi.stubGlobal('fetch',transport);
 const pending=completeLive('anthropic',request,h.context);
 await vi.waitFor(()=>expect(transport).toHaveBeenCalledOnce());
 await vi.advanceTimersByTimeAsync(30000);
 expect(await pending).toEqual({ok:false,reason:'provider_timeout'});
 expect(transport).toHaveBeenCalledOnce();expect(h.settle).toHaveBeenCalledWith(h.context.request_id,'timeout',h.rows[0]!.reserved_usd,null,expect.any(Number));
 });
});
