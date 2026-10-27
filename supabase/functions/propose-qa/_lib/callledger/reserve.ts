import {MAX_TOKENS,inputTokensUpper} from '../providers/prompt.ts';
import type {Price} from './prices.ts';
export const MAX_CAP_USD=40;
export function capUsd(value:unknown):number{
 const cap=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):0;
 if(!Number.isFinite(cap)||cap<=0||cap>MAX_CAP_USD)throw new Error('cap_absent_zero_or_out_of_range');return cap;
}
export function reservationUsd(body:string,price:Price):number{
 if(!price.verified)throw new Error('price_unverified');
 const amount=(inputTokensUpper(body)*price.input_per_million+MAX_TOKENS*price.output_per_million)/1000000;
 if(!Number.isFinite(amount)||amount<0)throw new Error('invalid_reservation');return Math.ceil(amount*1000000000)/1000000000;
}
export async function bodyHash(body:string):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
