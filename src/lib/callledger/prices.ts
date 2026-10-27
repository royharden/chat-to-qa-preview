import type {ProviderId} from '../providers/types.ts';
export const PRICE_TABLE_DATE='2026-10-27';
export type Price={provider:ProviderId;model:string;input_per_million:number;output_per_million:number;verified:boolean;verified_at:string|null};
/** No verified price/model approval exists. Empty table fails closed; no live transport can pass. */
export const PRICES:readonly Price[]=Object.freeze([]);
export const MODELS=Object.freeze({anthropic:['claude-sonnet-4-5-20250929'],openai:['gpt-4.1-mini']});
export function approvedPrice(provider:'anthropic'|'openai',model:string):Price{
 if(!(MODELS[provider] as readonly string[]).includes(model))throw new Error('model_not_allowlisted');
 const price=PRICES.find(p=>p.provider===provider&&p.model===model);
 if(!price?.verified||!price.verified_at||!Number.isFinite(price.input_per_million)||!Number.isFinite(price.output_per_million)||price.input_per_million<0||price.output_per_million<0)throw new Error('price_unverified');
 return price;
}
