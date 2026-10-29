import {describe,it,expect} from 'vitest';
import {coverageChecks,devShape} from '../../scripts/admit-data.ts';
import type {AdmissionSession} from '../../scripts/admit-data.ts';
import {slotValue} from '../../src/lib/fixtures/slots.ts';
import type {SlotKind} from '../../src/lib/fixtures/slots.ts';
import {seeded} from '../../src/lib/fixtures/prng.ts';

// Only runtime-built policy inputs: no held-out corpus or admission receipt is authored here.
function session(kind:SlotKind,count:number,index=0):AdmissionSession{
 const random=seeded(100+index);
 const slots=Array.from({length:count},(_,n)=>({id:'slot-'+n,kind,value:slotValue(kind,random)}));
 return {id:'session-'+index,slots,targets:slots.map(s=>s.id),traps:[]};
}
function passed(sessions:AdmissionSession[],id:string):boolean{
 const check=coverageChecks(sessions).find(c=>c.id===id);
 expect(check).toBeDefined();
 return check!.passed;
}
describe('admission coverage policy',()=>{
 it('accepts ten controlled UUID instances in one session while retaining high/medium and family floors',()=>{
 const sessions=[session('UUID',10),session('EMAIL',10,1)];
 expect(passed(sessions,'coverage_UUID')).toBe(true);
 expect(passed(sessions,'coverage_EMAIL')).toBe(false);
 expect(passed(sessions,'family_ids')).toBe(false);
 expect(passed([session('UUID',30)],'family_ids')).toBe(true);
 });
 it('still rejects UUID below ten instances or below ten controlled placements',()=>{
 expect(passed([session('UUID',9)],'coverage_UUID')).toBe(false);
 const input=session('UUID',10);input.targets.pop();
 expect(passed([input],'coverage_UUID')).toBe(false);
 });
 it('retains each high/medium floor: distinct ids, session spread and controlled placements',()=>{
 const valid=Array.from({length:10},(_,i)=>session('EMAIL',2,i));
 expect(passed(valid,'coverage_EMAIL')).toBe(true);
 expect(passed([session('EMAIL',20)],'coverage_EMAIL')).toBe(false);
 const repeated=Array.from({length:10},(_,i)=>({...session('EMAIL',2),id:'session-'+i}));
 expect(passed(repeated,'coverage_EMAIL')).toBe(false);
 const outside=valid.map((s,i)=>({...s,targets:i<4?s.targets:[]}));
 expect(passed(outside,'coverage_EMAIL')).toBe(false);
 });
});
describe('development admission shape',()=>{
 function manifest(){return {lineage:'builder-dev',entries:Array.from({length:10},(_,i)=>({id:'dev-'+i,template:'dev-'+i+'.md.tmpl',labels:'dev-'+i+'.labels.json',seeds:[i*2,i*2+1]}))};}
 it('requires two seeds on every one of the ten templates, not only twenty total',()=>{
 const valid=manifest();expect(devShape(valid,20)).toBe(true);
 const uneven=manifest();uneven.entries[0]!.seeds.pop();uneven.entries[1]!.seeds.push(20);
 expect(uneven.entries.flatMap(e=>e.seeds)).toHaveLength(20);
 expect(devShape(uneven,20)).toBe(false);
 });
});
