import {describe,it,expect} from 'vitest';
import {CandidateSchema} from '../../src/lib/providers/schema.ts';

const revision='0'.repeat(16);
function candidate(lengths:number[]){
 const block=(text:string)=>({kind:'sentence' as const,text,spans:[{turn_id:'t1',start:0,end:1,source_revision:revision}]});
 return {source_revision:revision,question:block('How?'),answer:lengths.map(length=>block('a'.repeat(length)))};
}
// what_bug_this_catches: eight 250-unit block texts passed although separators made the answer 2,014 units.
describe('model answer representation limit (unexecuted)',()=>{
 it('rejects eight blocks whose text alone totals 2000 but joined answer exceeds the limit',()=>{
  const value=candidate(Array.from({length:8},()=>250));
  expect(value.answer.map(b=>b.text).join('\n\n')).toHaveLength(2014);
  expect(CandidateSchema.safeParse(value).success).toBe(false);
 });
 it('accepts exactly 2000 joined UTF-16 units and rejects 2001',()=>{
  const lengths=[243,...Array.from({length:7},()=>249)];
  const boundary=candidate(lengths);
  expect(boundary.answer.map(b=>b.text).join('\n\n')).toHaveLength(2000);
  expect(CandidateSchema.safeParse(boundary).success).toBe(true);
  expect(CandidateSchema.safeParse(candidate([244,...lengths.slice(1)])).success).toBe(false);
 });
 it('keeps a one-block answer at the same 2000-unit boundary',()=>{
  expect(CandidateSchema.safeParse(candidate([2000])).success).toBe(true);
  expect(CandidateSchema.safeParse(candidate([2001])).success).toBe(false);
 });
});
