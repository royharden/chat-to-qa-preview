import type {RedactedRequest} from '../select/modelInput.ts';
import type {QaCandidate} from '../select/types.ts';
import type {Ledger} from '../callledger/ledger.ts';
export type {RedactedRequest} from '../select/modelInput.ts';
export type ProviderId='mock'|'anthropic'|'openai';
export type ProviderResult={ok:true;candidate:QaCandidate;usage:{input_tokens:number;output_tokens:number}|null}|{ok:false;reason:string};
export type LiveContext={apiKey:string;model:string;request_id:string;run_id:string;operator_id:string;ledger:Ledger;confirmProviderSend:boolean};
export interface Provider{complete(request:RedactedRequest,context?:LiveContext):Promise<ProviderResult>}
