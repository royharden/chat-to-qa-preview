import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {verifyRedacted,isRedactedSession} from './_lib/redactkit/index.ts';
import {buildModelInput} from './_lib/select/modelInput.ts';
import {anthropicProvider} from './_lib/providers/anthropic.ts';
import type {Ledger} from './_lib/callledger/ledger.ts';
const Input=z.object({request_id:z.string().uuid(),source_revision:z.string().regex(/^[a-f0-9]{16}$/),rules_version:z.string().max(80),confirm_provider_send:z.literal(true),turns:z.array(z.object({id:z.string().max(10),role:z.enum(['user','assistant']),text:z.string().max(100000)}).strict()).min(2).max(2000)}).strict();
type Env=(name:string)=>string|undefined;
export function createHandler(env:Env){
 return async (req:Request):Promise<Response>=>{
 const origin=req.headers.get('Origin'),allowed=(env('ALLOWED_ORIGINS')??'').split(',').map(x=>x.trim()).filter(Boolean);
 const cors:Record<string,string>={'Vary':'Origin'};if(origin&&allowed.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(origin&&!allowed.includes(origin))return reply(403,{error:'origin_refused'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'}});
 if(req.method!=='POST')return reply(405,{error:'method_refused'});
 const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),key=env('ANTHROPIC_API_KEY');
 if(!url||!service)return reply(503,{error:'backend_unconfigured'});
 const authorization=req.headers.get('Authorization')??'',jwt=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 if(!jwt)return reply(401,{error:'verified_user_required'});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 // getUser verifies the user with Auth; decoding a JWT is never treated as authentication.
 const identity=await db.auth.getUser(jwt);
 const user=identity.data.user,operators=(env('OPERATOR_EMAILS')??'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 if(identity.error||!user||!user.email||!user.email_confirmed_at||!operators.includes(user.email.toLowerCase()))return reply(403,{error:'operator_refused'});
 let input:z.infer<typeof Input>;
 try{const reader=req.body?.getReader();if(!reader)return reply(400,{error:'empty_input'});
 const decoder=new TextDecoder('utf-8',{fatal:true});let text='',bytes=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>5*1024*1024){await reader.cancel();return reply(413,{error:'input_limit'});}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 input=Input.parse(JSON.parse(text));}catch{return reply(400,{error:'invalid_request'});}
 const session=await verifyRedacted(input.turns,input.rules_version);
 if(!isRedactedSession(session))return reply(422,{error:'redaction_findings'});
 if(session.source_revision!==input.source_revision)return reply(409,{error:'source_revision_mismatch'});
 const selected=buildModelInput(session);if(!selected.ok)return reply(422,{error:selected.reason});
 if(!key)return reply(503,{error:'provider_unconfigured'});
 const ledger:Ledger={
 async reserve(row){const {error}=await db.rpc('reserve_call_budget',{request_id:row.request_id,operator_id:user.id,max_usd:row.reserved_usd,metadata:{id:row.id,run_id:row.run_id,provider:row.provider,model:row.model,prompt_sha256:row.prompt_sha256,input_turn_ids:row.input_turn_ids,input_units:row.input_units}});if(error)throw new Error('reservation_refused');},
 async settle(id,status,usd,usage,latency){const {error}=await db.rpc('settle_call',{request_id:id,usage_json:usage,settled_usd:usd,final_status:status,latency_ms:latency});if(error)throw new Error('settlement_refused');},
 };
 const result=await anthropicProvider.complete(selected.request,{apiKey:key,model:'claude-sonnet-4-5-20250929',request_id:input.request_id,run_id:'server-v1',operator_id:user.id,ledger,confirmProviderSend:true});
 // No transcript logging. Selected ids/count are included in the durable ledger reservation.
 return reply(result.ok?200:422,result);
 };
}
if(import.meta.main)Deno.serve(createHandler(name=>Deno.env.get(name)));
