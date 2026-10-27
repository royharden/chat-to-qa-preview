import type {RedactedSession} from '../redactkit/brand.ts';
import {isRedactedSession} from '../redactkit/index.ts';
/** Loaded only by explicit live-mode action. No client/service/provider secret is persisted. */
export async function proposeLive(session:RedactedSession,config:{url:string;anonKey:string;accessToken:string},confirmProviderSend:boolean){
 if(!confirmProviderSend||!config.accessToken||!isRedactedSession(session))throw new Error('provider_confirmation_required');
 const {createClient}=await import('@supabase/supabase-js');
 const url=new URL(config.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw new Error('backend_url_refused');
 const client=createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.functions.invoke('propose-qa',{headers:{Authorization:'Bearer '+config.accessToken},body:{request_id:crypto.randomUUID(),source_revision:session.source_revision,rules_version:session.rules_version,turns:session.turns,confirm_provider_send:true}});
 if(error)throw new Error('propose_qa_failed');return data as unknown;
}
