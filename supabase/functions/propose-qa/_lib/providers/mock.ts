import type {Provider,ProviderResult} from './types.ts';
import type {RedactedRequest} from '../select/modelInput.ts';
import {isRedactedRequest} from '../select/modelInput.ts';
import {parseCandidate} from './schema.ts';
import {splitBlocks} from '../spanground/split.ts';
/** Offline, extractive mock. Makes no transport calls and is the default. */
export const mockProvider:Provider={async complete(request:RedactedRequest):Promise<ProviderResult>{
 if(!isRedactedRequest(request))return {ok:false,reason:'redacted_request_required'};
 const u=request.turns.find(t=>t.id===request.pair.user_turn_id),a=request.turns.find(t=>t.id===request.pair.assistant_turn_id);
 if(!u||!a)return {ok:false,reason:'no_qualifying_pair'};
 const q=splitBlocks(u.text),answer=splitBlocks(a.text);if(!q.ok||!answer.ok)return {ok:false,reason:'invalid_blocks'};
 const question=q.blocks.find(b=>b.kind==='sentence');if(!question)return {ok:false,reason:'invalid_blocks'};
 const cite=(b:typeof question,id:string)=>({kind:b.kind,text:b.text,spans:[{turn_id:id,start:b.start,end:b.end,source_revision:request.source_revision}]});
 try{const candidate=parseCandidate({source_revision:request.source_revision,question:cite(question,u.id),answer:answer.blocks.slice(0,8).map(b=>cite(b,a.id))},request);return {ok:true,candidate,usage:null};}catch{return {ok:false,reason:'mock_candidate_limits_or_grounding'};}
}};
export const defaultProvider=mockProvider;
