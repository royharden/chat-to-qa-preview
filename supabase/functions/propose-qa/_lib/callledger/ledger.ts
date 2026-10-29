export type LedgerRow={id:string;run_id:string;request_id:string;operator_id:string;provider:string;model:string;prompt_sha256:string;input_turn_ids:readonly string[];input_units:number;reserved_usd:number;settled_usd:number|null;usage_json:unknown|null;latency_ms:number;status:'reserved'|'settled'|'failed'|'timeout';created_at:string};
export interface Ledger{
 reserve(row:LedgerRow):Promise<void>;
 settle(requestId:string,status:'settled'|'failed'|'timeout',settledUsd:number,usage:unknown|null,latencyMs:number):Promise<void>;
}
export function totalCommitted(rows:readonly LedgerRow[]):number{return rows.reduce((n,r)=>n+(r.status==='reserved'?r.reserved_usd:(r.settled_usd??r.reserved_usd)),0);}
