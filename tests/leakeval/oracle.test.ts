import { describe, expect, it } from 'vitest';
import { leaked, leakedIds } from '../../src/lib/leakeval/oracle.ts';
import { evaluateSession } from '../../src/lib/leakeval/tracks.ts';
// what_bug_this_catches: a detector-dependent oracle, escaped-field leaks, and false zero-denominator success.
describe('independent value oracle (unexecuted)',()=>{
  it('finds full, JSON-escaped, URL-encoded, split and partial secrets',()=>{
    const value=['s','k-','aB1cD2eF3gH4iJ5kL6mN7pQ8'].join('');
    const planted={id:'slot-1',kind:'OPENAI_KEY',value};
    expect(leaked(value,planted)).toBe(true);
    expect(leaked(value.replace('s','\\u0073'),planted)).toBe(true);
    expect(leaked(encodeURIComponent(value),planted)).toBe(true);
    expect(leaked(value.slice(0,9)+'\n'+value.slice(9),planted)).toBe(true);
    expect(leaked(value.slice(5,17),planted)).toBe(true);
    expect(leaked('[TOKEN_1]',planted)).toBe(false);
    expect(leakedIds(value,[planted])).toEqual(['slot-1']);
  });
  it('reports evaluator arms without permitting baseline exports from product paths',async()=>{
    const contact=['seed','@example.test'].join('');
    const question='How should I set the contact?';const answer=`Use ${contact} for the contact.`;
    const result=await evaluateSession({session:{turns:[{id:'t1',role:'user',text:question},{id:'t2',role:'assistant',text:answer}]},
      identifiers:[{id:'s1',kind:'EMAIL',value:contact}],decoys:[],question:{turn_id:'t1',start:0,end:question.length},
      targets:[{id:'target1',spans:[{turn_id:'t2',start:0,end:answer.length}],slot_ids:['s1'],anchors:['Use','for the','contact']}]},'unit-1');
    expect(result.rows.find(r=>r.track==='controlled'&&r.redaction_arm==='R0'&&r.format==='md')?.leaked_ids).toBe(1);
    expect(result.rows.find(r=>r.track==='controlled'&&r.redaction_arm==='R2'&&r.format==='md')?.leaked_ids).toBe(0);
    expect(result.failures.every(f=>!Object.values(f).some(v=>String(v).includes(contact)))).toBe(true);
  });
});
