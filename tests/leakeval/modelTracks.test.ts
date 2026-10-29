import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {generate} from '../../src/lib/fixtures/generate.ts';
import {materialiseLabels} from '../../src/lib/fixtures/labels.ts';
import type {TemplateLabels} from '../../src/lib/fixtures/labels.ts';
import {DECOYS} from '../../src/lib/fixtures/slots.ts';
import {evaluateModelBoundaries,evaluateModelDiagnostics} from '../../src/lib/leakeval/modelTracks.ts';
import {SIMULATIONS,simulationIdentifiers} from '../../src/lib/select/simulated.ts';
describe('mock and simulated model measurement',()=>{
 it('measures actual injected bytes before gate and reports blocked final-byte eligibility',async()=>{
 const dir=new URL('../../fixtures/dev/',import.meta.url),template=readFileSync(new URL('dev-01.md.tmpl',dir),'utf8'),spec=JSON.parse(readFileSync(new URL('dev-01.labels.json',dir),'utf8')) as TemplateLabels;
 const generated=generate(template,1047),labels=materialiseLabels(spec,generated);
 const input={session:generated.session,question:labels.gold_question,targets:labels.controlled_targets,identifiers:generated.slots.filter(s=>!DECOYS.includes(s.kind)),decoys:generated.slots.filter(s=>DECOYS.includes(s.kind))};
 const {rows,failures}=await evaluateModelDiagnostics(input,'dev-01:1047');
 expect(await evaluateModelBoundaries(input,'dev-01:1047')).toEqual(rows);
 for(const row of rows){
 expect(row.session_ids).toEqual(['dev-01:1047']);
 expect(row.planted_unit_ids?.length).toBe(row.planted_ids);
 expect(row.residual_unit_ids?.length).toBe(row.residual_before_gate);
 expect(row.eligible_unit_ids?.length).toBe(row.eligible_ids);
 expect(row.leaked_unit_ids?.length).toBe(row.leaked_ids);
 }
 for(const failure of failures){
 expect([...input.identifiers.map(i=>i.id),'r3-injected-email','r3-injected-key']).toContain(failure.identifier_or_mutation_id);
 expect(generated.slots.every(s=>!JSON.stringify(failure).includes(s.value))).toBe(true);
 }
 const wrongTurn=rows.filter(r=>r.mutator==='wrong_turn');
 expect(wrongTurn.every(r=>r.span_total!==undefined&&r.valid_span_count!==undefined&&r.valid_span_count<r.span_total)).toBe(true);
 expect(rows.filter(r=>r.track==='model_end_to_end').every(r=>r.anchor_total!==undefined&&r.gold_source_total!==undefined)).toBe(true);

 expect(rows.some(r=>r.track==='redacted_request_boundary')).toBe(true);
 for(const mode of SIMULATIONS)expect(rows.some(r=>r.mode==='simulated'&&r.mutator===mode)).toBe(true);
 for(const mode of ['identifier_injection','injected_instruction'] as const){
 const identifier=simulationIdentifiers(mode)[0]!;
 expect(failures.some(f=>f.identifier_or_mutation_id===identifier.id&&f.placement_trap===mode&&f.observed==='blocked_residual')).toBe(true);
 const measured=rows.filter(r=>r.mode==='simulated'&&r.mutator===mode&&r.class===identifier.kind);
 expect(measured).toHaveLength(2);
 for(const r of measured){expect(r.residual_before_gate).toBeGreaterThan(0);expect(r.gate_eligible_sessions).toBe(0);expect(r.leaked_ids).toBe(0);expect(r.artifact_leak_rate).toBe('NA');expect(r.blocked).toBe(1);}
 }
 });
});
