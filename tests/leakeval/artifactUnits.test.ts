import {describe,it,expect} from 'vitest';
import {evaluateSession} from '../../src/lib/leakeval/tracks.ts';
import {evaluateModelDiagnostics} from '../../src/lib/leakeval/modelTracks.ts';
import {aggregate} from '../../src/lib/evalkit/cluster.ts';
import type {EvaluationInput} from '../../src/lib/leakeval/tracks.ts';
// what_bug_this_catches: producer class expansion duplicated one EMAIL+PHONE artifact's family outcomes.
describe('producer artifact units (unexecuted)',()=>{
 function input():EvaluationInput{
  const email=['fixture','@example.test'].join(''),phone=['555','0101'].join('-');
  const question='How should I use --strict for configuration?',answer='Use --strict for configuration and contact '+email+' or '+phone+'.';
  return {session:{turns:[{id:'t1',role:'user',text:question},{id:'t2',role:'assistant',text:answer}]},
   question:{turn_id:'t1',start:0,end:question.length},targets:[{id:'target',spans:[{turn_id:'t2',start:0,end:answer.length}],slot_ids:['mail','phone'],anchors:['Use','--strict','configuration']}],
   identifiers:[{id:'mail',kind:'EMAIL',value:email},{id:'phone',kind:'PHONE',value:phone}],decoys:[]};
 }
 it('counts one extractive artifact after same-family identifier expansion',async()=>{
  const result=await evaluateSession(input(),'same-family-session');
  const rows=result.rows.filter(r=>r.track==='end_to_end'&&r.redaction_arm==='R0'&&r.format==='md');
  expect(rows).toHaveLength(2);
  const family=aggregate(rows,true)[0]!;
  expect(family.sessions).toBe(1);expect(family.downloadable).toBe(1);expect(family.artifact_traces).toHaveLength(1);
 });
 it('counts one mock-model artifact after same-family identifier expansion',async()=>{
  const result=await evaluateModelDiagnostics(input(),'same-family-session');
  const rows=result.rows.filter(r=>r.track==='model_end_to_end'&&r.format==='md');
  expect(rows).toHaveLength(2);
  const family=aggregate(rows,true)[0]!;
  expect(family.sessions).toBe(1);expect(family.downloadable).toBe(1);expect(family.artifact_traces).toHaveLength(1);
 });
});
