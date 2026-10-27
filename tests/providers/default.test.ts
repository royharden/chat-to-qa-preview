import {describe,it,expect} from 'vitest';
import {defaultProvider,mockProvider} from '../../src/lib/providers/mock.ts';
import {approvedPrice,PRICES} from '../../src/lib/callledger/prices.ts';
import {anthropicProvider} from '../../src/lib/providers/anthropic.ts';
describe('default zero-spend gates',()=>{
 it('defaults to mock and has no verified prices',()=>{expect(defaultProvider).toBe(mockProvider);expect(PRICES).toEqual([]);expect(()=>approvedPrice('anthropic','claude-sonnet-4-5-20250929')).toThrow('price_unverified');});
 it('rejects unbranded provider requests before transport',async()=>{
 const result=await anthropicProvider.complete({turns:[]} as never);
 expect(result).toEqual({ok:false,reason:'live_context_required'});
 });
});
