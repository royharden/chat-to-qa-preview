import {describe,it,expect} from 'vitest';
import {capUsd,reservationUsd} from '../../src/lib/callledger/reserve.ts';
import {inputTokensUpper,MAX_TOKENS} from '../../src/lib/providers/prompt.ts';
import {totalCommitted} from '../../src/lib/callledger/ledger.ts';
import type {LedgerRow} from '../../src/lib/callledger/ledger.ts';
describe('reservation arithmetic',()=>{
 it('refuses absent, zero, infinite and excess caps',()=>{for(const cap of [undefined,'',0,-1,41,Infinity,NaN])expect(()=>capUsd(cap)).toThrow();expect(capUsd('3')).toBe(3);});
 it('uses full body UTF-8 bytes plus overhead and maximum output',()=>{
 const body='λ',price={provider:'anthropic' as const,model:'test',input_per_million:1,output_per_million:2,verified:true,verified_at:'2026-10-27'};
 expect(reservationUsd(body,price)).toBeCloseTo((inputTokensUpper(body)+MAX_TOKENS*2)/1000000,9);
 expect(()=>reservationUsd(body,{...price,verified:false})).toThrow('price_unverified');
 });
 it('counts open and settled reservations cumulatively including unknown usage',()=>{
 const base={reserved_usd:1,settled_usd:null,status:'reserved'} as LedgerRow;
 expect(totalCommitted([base,{...base,status:'timeout',settled_usd:1},{...base,status:'settled',settled_usd:0.25}])).toBe(2.25);
 });
});
