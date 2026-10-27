import {describe,it,expect} from 'vitest';
import {emptyRow} from '../../src/lib/evalkit/counts.ts';
import {highTierStop} from '../../scripts/eval.ts';
import {evaluateSession} from '../../src/lib/leakeval/tracks.ts';
// what_bug_this_catches: high-tier whole-transcript misses had leaked_ids=0 and incorrectly printed success.
describe('high-tier stop predicate (unexecuted)',()=>{
 it('stops for a transcript-boundary residual even without an eligible artifact leak',()=>{
  const boundary=emptyRow({redaction_arm:'R2',family:'secrets',track:'end_to_end_redacted_transcript_boundary',residual_before_gate:1,leaked_ids:0});
  expect(highTierStop([boundary])).toBe(true);
  expect(highTierStop([{...boundary,track:'redacted_request_boundary'}])).toBe(true);
  expect(highTierStop([{...boundary,redaction_arm:'R1'}])).toBe(false);
  expect(highTierStop([{...boundary,family:'contact'}])).toBe(false);
  expect(highTierStop([{...boundary,residual_before_gate:0}])).toBe(false);
 });
 it('retains the exported high-tier leak stop independently of boundary metrics',()=>{
  expect(highTierStop([emptyRow({redaction_arm:'R2',family:'secrets',track:'controlled',leaked_ids:1})])).toBe(true);
 });
 it('stops on a real evaluator boundary miss outside the selected answer',async()=>{
  const hidden=['novel','unprefixed','42'].join('');
  const question='How should I use --strict for configuration?',answer='Use --strict for configuration.';
  const result=await evaluateSession({session:{turns:[{id:'t1',role:'user',text:'Start with the earlier context.'},{id:'t2',role:'assistant',text:'Earlier note: '+hidden+'.'},
   {id:'t3',role:'user',text:question},{id:'t4',role:'assistant',text:answer}]},identifiers:[{id:'outside-selected-pair',kind:'AWS_SECRET',value:hidden}],decoys:[],
   question:{turn_id:'t3',start:0,end:question.length},targets:[{id:'target',spans:[{turn_id:'t4',start:0,end:answer.length}],slot_ids:[],anchors:['Use','--strict','configuration']}]},'boundary-source-case');
  const boundary=result.rows.filter(r=>r.redaction_arm==='R2'&&r.track==='end_to_end_redacted_transcript_boundary');
  expect(boundary).toHaveLength(1);expect(boundary[0]!.residual_before_gate).toBe(1);expect(boundary[0]!.leaked_ids).toBe(0);
  expect(result.rows.filter(r=>r.redaction_arm==='R2'&&r.track==='end_to_end').every(r=>r.leaked_ids===0)).toBe(true);
  expect(highTierStop(result.rows)).toBe(true);
 });
});
