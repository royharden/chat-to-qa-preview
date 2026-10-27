import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {generate} from '../../src/lib/fixtures/generate.ts';
import {materialiseLabels} from '../../src/lib/fixtures/labels.ts';
import type {TemplateLabels} from '../../src/lib/fixtures/labels.ts';
import {SLOT_KINDS,slotValue} from '../../src/lib/fixtures/slots.ts';
import {seeded} from '../../src/lib/fixtures/prng.ts';
import {reservedValue} from '../../src/lib/fixtures/ranges.ts';
const dir=new URL('../../fixtures/dev/',import.meta.url);
type Entry={template:string;labels:string;seeds:number[]};
const manifest=JSON.parse(readFileSync(new URL('MANIFEST.json',dir),'utf8')) as {entries:Entry[]};
describe('synthetic fixture contract',()=>{
 it('has ten templates and twenty seed sessions, all complete and deterministic',()=>{
 expect(manifest.entries).toHaveLength(10);
 expect(manifest.entries.flatMap(e=>e.seeds)).toHaveLength(20);
 for(const e of manifest.entries){
 const text=readFileSync(new URL(e.template,dir),'utf8'),spec=JSON.parse(readFileSync(new URL(e.labels,dir),'utf8')) as TemplateLabels;
 for(const seed of e.seeds){const result=generate(text,seed);
 expect(generate(text,seed)).toEqual(result);
 expect(result.session.turns.length).toBeGreaterThanOrEqual(12);
 expect(result.session.turns.length).toBeLessThanOrEqual(60);
 expect(JSON.parse(result.json)).toEqual(result.session);
 expect(result.json).not.toContain('Tool: diagnostic');
 expect(result.json).not.toContain('Provenance:');
 const gold=materialiseLabels(spec,result);expect(gold.controlled_targets).toHaveLength(2);
 for(const t of gold.controlled_targets)for(const s of t.spans)expect(result.session.turns.find(t=>t.id===s.turn_id)!.text.slice(s.start,s.end)).not.toBe('');
 }
 }
 });
 it('all declared kinds use seeded generation and reserved ranges',()=>{
 for(const kind of SLOT_KINDS){const a=slotValue(kind,seeded(41)),b=slotValue(kind,seeded(41));expect(a).toBe(b);expect(reservedValue(kind,a)).toBe(true);}
 });
 it('rejects missing provenance and malformed slots before fixture use',()=>{
 expect(()=>generate('## 👤 User\nanything',1)).toThrow('missing_provenance');
 const text=readFileSync(new URL(manifest.entries[0]!.template,dir),'utf8');
 expect(()=>generate(text.replace('EMAIL:','UNKNOWN:'),1)).toThrow('unknown_slot');
 });
 it('rejects missing slot labels and anchors rather than silently reducing denominator',()=>{
 const e=manifest.entries[0]!,text=readFileSync(new URL(e.template,dir),'utf8'),spec=JSON.parse(readFileSync(new URL(e.labels,dir),'utf8')) as TemplateLabels;
 const result=generate(text,1);spec.controlled_targets[0]!.slot_ids=[];
 expect(()=>materialiseLabels(spec,result)).toThrow('incomplete_labels');
 });
});
