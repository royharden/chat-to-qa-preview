import { describe, expect, it } from 'vitest';
import { rate, emptyRow, artifactTrace, unitKey } from '../../src/lib/evalkit/counts.ts';
import type { ArtifactTrace } from '../../src/lib/evalkit/counts.ts';
import { aggregate } from '../../src/lib/evalkit/cluster.ts';
import { markdownResults } from '../../src/lib/evalkit/split.ts';
// what_bug_this_catches: sessions replacing identifier denominators and duplicate targets inflating planted units.
describe('evaluation counting (unexecuted)',()=>{
  it('keeps zero denominators NA and low counts out of rates',()=>{
    expect(rate(0,0)).toBe('NA');expect(rate(1,4)).toBe(.25);expect(()=>rate(2,1)).toThrow();
    expect(markdownResults([emptyRow({status:'NA'})])).toContain('counts only');
  });
  it('deduplicates per-session identifier units across controlled targets',()=>{
    const row=emptyRow({sessions:1,planted_ids:1,eligible_ids:1,leaked_ids:1,status:'ok',session_ids:['s1'],target_ids:['s1:a'],planted_unit_ids:['s1:id1'],eligible_unit_ids:['s1:id1'],leaked_unit_ids:['s1:id1'],residual_unit_ids:['s1:id1'],eligible_session_ids:['s1']});
    const result=aggregate([row,{...row,target_ids:['s1:b']}])[0]!;
    expect(result.sessions).toBe(1);expect(result.targets).toBe(2);expect(result.eligible_ids).toBe(1);expect(result.artifact_leak_rate).toBe(1);
  });
  // what_bug_this_catches: contact artifacts with EMAIL+PHONE used to count twice and outweigh EMAIL-only artifacts.
  it('deduplicates artifact outcomes and utility independently of unequal per-artifact class inventories',()=>{
    const a=artifactTrace('artifact-a',{downloadable:1,decoy_false_redactions:1,anchor_retained_count:3,anchor_coverage_count:2,anchor_total:4,valid_span_count:1,span_total:2,gold_source_hits:1,gold_source_total:1});
    const b=artifactTrace('artifact-b',{blocked:1,decoy_false_redactions:2,anchor_retained_count:1,anchor_coverage_count:0,anchor_total:2,valid_span_count:1,span_total:1,gold_source_hits:0,gold_source_total:1});
    const c=artifactTrace('artifact-c',{abstained:1,decoy_false_redactions:3,anchor_retained_count:0,anchor_coverage_count:0,anchor_total:3});
    const row=(session:string,kind:string,trace:ArtifactTrace)=>emptyRow({family:'contact',class:kind,sessions:1,targets:1,planted_ids:1,eligible_ids:trace.downloadable,
      session_ids:[session],target_ids:[unitKey(session,'target')],planted_unit_ids:[unitKey(session,kind)],eligible_unit_ids:trace.downloadable?[unitKey(session,kind)]:[],leaked_unit_ids:[],residual_unit_ids:[],eligible_session_ids:trace.downloadable?[session]:[],artifact_traces:[trace],
      blocked:trace.blocked,abstained:trace.abstained,downloadable:trace.downloadable,decoy_false_redactions:trace.decoy_false_redactions,anchor_retained_count:trace.anchor_retained_count,anchor_coverage_count:trace.anchor_coverage_count,anchor_total:trace.anchor_total,valid_span_count:trace.valid_span_count,span_total:trace.span_total,gold_source_hits:trace.gold_source_hits,gold_source_total:trace.gold_source_total,status:'ok'});
    const rows=[row('a','EMAIL',a),row('a','PHONE',a),row('b','EMAIL',b),row('c','EMAIL',c),row('c','PHONE',c)];
    const result=aggregate(rows,true)[0]!;
    expect(result.sessions).toBe(3);expect(result.targets).toBe(3);expect(result.planted_ids).toBe(5);expect(result.eligible_ids).toBe(2);
    expect(result.blocked).toBe(1);expect(result.abstained).toBe(1);expect(result.downloadable).toBe(1);expect(result.decoy_false_redactions).toBe(6);
    expect(result.anchor_retained_count).toBe(4);expect(result.anchor_total).toBe(9);expect(result.anchor_retention).toBe(4/9);expect(result.anchor_coverage).toBe(2/9);
    expect(result.valid_span_count).toBe(2);expect(result.span_total).toBe(3);expect(result.span_validity).toBe(2/3);expect(result.gold_source_turn_hit).toBe(.5);
    expect(result.session_ids).toEqual(['a','b','c']);expect(result.planted_unit_ids).toHaveLength(5);expect(result.artifact_traces).toHaveLength(3);
    // Reaggregating already aggregated cells retains full traces and totals, never only the first source row.
    expect(aggregate(aggregate(rows),true)[0]).toEqual(result);
    expect(aggregate([...rows,...rows.map(r=>({...r,format:'json' as const}))],true)).toHaveLength(2);
  });
  it('uses collision-free session/identifier tuple keys',()=>{
    expect(unitKey('a:b','c')).not.toBe(unitKey('a','b:c'));
  });
});
