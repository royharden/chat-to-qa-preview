import type {RedactedSession,RedactedTurn} from '../redactkit/brand.ts';
import {isRedactedSession} from '../redactkit/index.ts';
import {modelViewTurns} from '../session/views.ts';
import {rankPairs} from './extractive.ts';
declare const redactedRequest:unique symbol;
export type RedactedRequest={readonly [redactedRequest]:true;readonly turns:readonly RedactedTurn[];readonly source_revision:string;readonly rules_version:string;readonly input_turn_ids:readonly string[];readonly input_units:number;readonly pair:Readonly<{user_turn_id:string;assistant_turn_id:string}>};
const genuine=new WeakSet<object>();
export function isRedactedRequest(value:unknown):value is RedactedRequest{return typeof value==='object'&&value!==null&&genuine.has(value);}
export const MODEL_INPUT_LIMIT=24000;
export function buildModelInput(session:RedactedSession):{ok:true;request:RedactedRequest;input_turn_ids:readonly string[];input_units:number}|{ok:false;reason:'invalid_session'|'no_qualifying_pair'|'model_input_limit'}{
 if(!isRedactedSession(session))return {ok:false,reason:'invalid_session'};
 const pair=rankPairs(session)[0];if(!pair)return {ok:false,reason:'no_qualifying_pair'};
 const turns=modelViewTurns(session,new Set()),u=pair.user_index,a=pair.assistant_index;
 const core=[turns[u]!,turns[a]!];if(core.reduce((n,t)=>n+t.text.length,0)>MODEL_INPUT_LIMIT)return {ok:false,reason:'model_input_limit'};
 let selected=turns.slice(Math.max(0,u-1),Math.min(turns.length,a+2));
 // The first following assistant can only be adjacent in the eligible view; reject surprises.
 if(selected.length>4)return {ok:false,reason:'model_input_limit'};
 while(selected.reduce((n,t)=>n+t.text.length,0)>MODEL_INPUT_LIMIT){const last=selected[selected.length-1]!;
 if(last.id!==core[1]!.id)selected=selected.slice(0,-1);else selected=selected.slice(1);}
 const frozen=Object.freeze(selected.map(t=>Object.freeze({...t}))),input_turn_ids=Object.freeze(frozen.map(t=>t.id)),input_units=frozen.reduce((n,t)=>n+t.text.length,0);
 const request=Object.freeze({turns:frozen,source_revision:session.source_revision,rules_version:session.rules_version,input_turn_ids,input_units,pair:Object.freeze({user_turn_id:pair.user_turn_id,assistant_turn_id:pair.assistant_turn_id})}) as RedactedRequest;
 genuine.add(request);return {ok:true,request,input_turn_ids,input_units};
}
