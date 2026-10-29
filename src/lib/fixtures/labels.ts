import type {Generated} from './generate.ts';
import {DECOYS} from './slots.ts';
export type SpanSpec={turn_id:string;text:string};
export type TargetSpec={id:string;spans:SpanSpec[];slot_ids:string[];anchors:string[]};
export type TemplateLabels={author:string;provenance:'synthetic';lineage:'builder-dev'|'independent-heldout';gold_question:SpanSpec;controlled_targets:TargetSpec[];decoys:string[];abstain_ok:boolean;traps:string[]};
export type GoldSpan={turn_id:string;start:number;end:number};
export function materialiseLabels(labels:TemplateLabels,generated:Generated){
 const ids=new Set(generated.slots.map(s=>s.id));
 const expand=(text:string)=>text.replace(/\{\{[A-Z_]+:([a-z][a-z0-9_-]*)\}\}/g,(_,id:string)=>{const s=generated.slots.find(s=>s.id===id);if(!s)throw new Error('unknown_label_slot');return s.value;});
 const span=(s:SpanSpec):GoldSpan=>{const t=generated.session.turns.find(t=>t.id===s.turn_id),text=expand(s.text),start=t?.text.indexOf(text)??-1;
 if(!text||start<0||t!.text.indexOf(text,start+1)>=0)throw new Error('missing_or_ambiguous_gold_span');return {turn_id:s.turn_id,start,end:start+text.length};};
 if(!labels.author||labels.provenance!=='synthetic'||labels.controlled_targets.length!==2||typeof labels.abstain_ok!=='boolean')throw new Error('invalid_labels');
 if(generated.session.turns.find(t=>t.id===labels.gold_question.turn_id)?.role!=='user')throw new Error('question_must_be_user');
 if(new Set(labels.controlled_targets.map(t=>t.id)).size!==2)throw new Error('duplicate_target');
 if(labels.decoys.some(id=>!DECOYS.includes(generated.slots.find(s=>s.id===id)?.kind as never)))throw new Error('non_decoy_label');
 if(labels.controlled_targets.some(t=>t.slot_ids.some(id=>DECOYS.includes(generated.slots.find(s=>s.id===id)?.kind as never))))throw new Error('decoy_in_target');
 const referenced=new Set([...labels.controlled_targets.flatMap(t=>t.slot_ids),...labels.decoys]);
 if([...ids].some(id=>!referenced.has(id))||[...referenced].some(id=>!ids.has(id)))throw new Error('incomplete_labels');
 const controlled_targets=labels.controlled_targets.map(t=>{
 if(t.anchors.length<3||t.anchors.length>6||new Set(t.anchors).size!==t.anchors.length||!t.spans.length)throw new Error('invalid_target');
 const spans=t.spans.map(span),text=t.spans.map(s=>expand(s.text)).join('\n');
 if(t.anchors.some(a=>!text.includes(a))||t.slot_ids.some(id=>!text.includes(generated.slots.find(s=>s.id===id)!.value)))throw new Error('target_coverage');
 return {...t,spans};
 });
 return {...labels,gold_question:span(labels.gold_question),controlled_targets};
}
