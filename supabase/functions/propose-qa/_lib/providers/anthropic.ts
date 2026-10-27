import type {Provider,ProviderResult,LiveContext} from './types.ts';
import type {RedactedRequest} from '../select/modelInput.ts';
import {isRedactedRequest} from '../select/modelInput.ts';
import {requestBody} from './prompt.ts';
import {parseCandidate} from './schema.ts';
import {approvedPrice} from '../callledger/prices.ts';
import {reservationUsd,bodyHash} from '../callledger/reserve.ts';
const ENDPOINTS={anthropic:'https://api.anthropic.com/v1/messages',openai:'https://api.openai.com/v1/chat/completions'} as const;
/** One bounded request; no retries. Failures and unknown usage retain the full reservation. */
export async function completeLive(provider:'anthropic'|'openai',request:RedactedRequest,c:LiveContext):Promise<ProviderResult>{
 if(!isRedactedRequest(request))return {ok:false,reason:'redacted_request_required'};
 if(!c.confirmProviderSend||!c.apiKey||!c.request_id||!c.operator_id)return {ok:false,reason:'live_confirmation_or_identity_missing'};
 let price,body:string,reserved:number;
 try{price=approvedPrice(provider,c.model);body=requestBody(request,provider,c.model);reserved=reservationUsd(body,price);}
 catch{return {ok:false,reason:'price_model_or_budget_unavailable'};}
 const started=Date.now();
 try{await c.ledger.reserve({id:crypto.randomUUID(),run_id:c.run_id,request_id:c.request_id,operator_id:c.operator_id,provider,model:c.model,prompt_sha256:await bodyHash(body),input_turn_ids:request.input_turn_ids,input_units:request.input_units,reserved_usd:reserved,settled_usd:null,usage_json:null,latency_ms:0,status:'reserved',created_at:new Date().toISOString()});}
 catch{return {ok:false,reason:'reservation_refused'};}
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
 let status:'settled'|'failed'|'timeout'='failed',usage:{input_tokens:number;output_tokens:number}|null=null,settled=reserved,result:ProviderResult={ok:false,reason:'provider_failed'};
 try{
 const headers:Record<string,string>={'Content-Type':'application/json'};
 if(provider==='anthropic'){headers['x-api-key']=c.apiKey;headers['anthropic-version']='2023-06-01';}else headers.Authorization='Bearer '+c.apiKey;
 const response=await fetch(ENDPOINTS[provider],{method:'POST',headers,body,signal:abort.signal,redirect:'error'});
 if(!response.ok)throw new Error('provider_http');
 const reader=response.body?.getReader();if(!reader)throw new Error('provider_empty');
 let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>128000){await reader.cancel();throw new Error('provider_response_limit');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 const data=JSON.parse(text) as Record<string,unknown>;
 let output:unknown,rawUsage:Record<string,unknown>|undefined;
 if(provider==='anthropic'){
 const blocks=data.content as {type:string;text?:string}[]|undefined;if(!Array.isArray(blocks)||blocks.length!==1||blocks[0]?.type!=='text')throw new Error('provider_shape');
 output=JSON.parse(blocks[0].text??'');rawUsage=data.usage as Record<string,unknown>|undefined;
 }else{
 const choices=data.choices as {message?:{content?:string}}[]|undefined;if(!Array.isArray(choices)||choices.length!==1)throw new Error('provider_shape');
 output=JSON.parse(choices[0]?.message?.content??'');const u=data.usage as Record<string,unknown>|undefined;rawUsage=u?{input_tokens:u.prompt_tokens,output_tokens:u.completion_tokens}:undefined;
 }
 if(rawUsage&&Number.isSafeInteger(rawUsage.input_tokens)&&Number.isSafeInteger(rawUsage.output_tokens)&&Number(rawUsage.input_tokens)>=0&&Number(rawUsage.output_tokens)>=0){
 usage={input_tokens:Number(rawUsage.input_tokens),output_tokens:Number(rawUsage.output_tokens)};
 const billed=(usage.input_tokens*price.input_per_million+usage.output_tokens*price.output_per_million)/1000000;
 // Never release more than the known charge; usage exceeding the upper bound is a blocking fault.
 if(billed>reserved)throw new Error('usage_exceeds_reservation');settled=billed;
 }
 const candidate=parseCandidate(output,request);status='settled';result={ok:true,candidate,usage};
 }catch{status=abort.signal.aborted?'timeout':'failed';settled=reserved;usage=null;result={ok:false,reason:status==='timeout'?'provider_timeout':'provider_or_schema_failure'};}
 finally{clearTimeout(timer);}
 try{await c.ledger.settle(c.request_id,status,settled,usage,Date.now()-started);}
 catch{return {ok:false,reason:'settlement_failed_reservation_retained'};}
 return result;
}
export const anthropicProvider:Provider={complete:(r,c)=>c?completeLive('anthropic',r,c):Promise.resolve({ok:false,reason:'live_context_required'})};
