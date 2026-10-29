import { noRedaction } from '../baselines/noRedaction.ts';
import { regexOnlyRedactAll } from '../baselines/regexOnly.ts';
import { redactSession } from '../redactkit/index.ts';
import { sourceRevision } from '../redactkit/revision.ts';
import type { TurnLike } from '../session/views.ts';
import { candidateTurns } from '../session/views.ts';
import { extractiveCore } from '../select/core.ts';
import type { QaCandidate, QaBlock } from '../select/types.ts';
import { checkCandidate } from '../spanground/index.ts';
import { splitBlocks } from '../spanground/split.ts';
import { validateSpan } from '../spans/validate.ts';
import type { SpanSource } from '../spans/validate.ts';
import { serializeCore } from '../artifact/core.ts';
import type { ArtifactContent } from '../artifact/core.ts';
import { scanArtifact } from '../artifact/scan.ts';
import { artifactTrace, emptyRow, rate, unitKey } from '../evalkit/counts.ts';
import type { ResultRow } from '../evalkit/counts.ts';
import { leakedIds } from './oracle.ts';
import type { PlantedIdentifier } from './oracle.ts';
import { MUTATORS } from '../mutators/index.ts';
export type Arm = 'R0' | 'R1' | 'R2';
export interface EvaluationInput {
  readonly session: { readonly turns: readonly TurnLike[] };
  readonly identifiers: readonly PlantedIdentifier[];
  readonly decoys: readonly PlantedIdentifier[];
  readonly question: { readonly turn_id: string; readonly start: number; readonly end: number };
  readonly targets: readonly { readonly id: string; readonly spans: readonly { readonly turn_id: string; readonly start: number; readonly end: number }[]; readonly slot_ids: readonly string[]; readonly anchors: readonly string[] }[];
}
export interface FailureRow { session: string; arm: string; format: string; identifier_or_mutation_id: string; class: string; placement_trap: string; expected: string; observed: string; stage: string; status: string; reason: string }
const family = (kind: string): string => ['EMAIL','PHONE'].includes(kind) ? 'contact' : ['IPV4','IPV6','INTERNAL_HOST'].includes(kind) ? 'network'
  : ['WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME'].includes(kind) ? 'people_places' : kind === 'UUID' ? 'ids' : 'secrets';
async function armSource(turns: readonly TurnLike[], arm: Arm): Promise<SpanSource | null> {
  const eligible = candidateTurns({ turns }, new Set());
  if (arm === 'R2') { const result = await redactSession({ turns: eligible }); return result.ok ? result : null; }
  const transformed = arm === 'R0' ? eligible.map(t=>noRedaction(t.text)) : regexOnlyRedactAll(eligible.map(t=>t.text)).map(t=>t.text);
  const output = eligible.map((t,i)=>({ id:t.id, role:t.role, text:transformed[i]! }));
  return { turns:output, source_revision:await sourceRevision(output, arm === 'R0' ? 'r0-no-redaction/1' : 'r1-regex-only/1') };
}
function content(source: SpanSource, qa: QaCandidate, arm: Arm): ArtifactContent | null {
  const excerpts: { span: QaBlock['spans'][number]; text: string }[] = []; const seen = new Set<string>(); let size = 0;
  for (const b of [qa.question,...qa.answer]) for (const span of b.spans) {
    const key=JSON.stringify(span); if(seen.has(key))continue;seen.add(key);
    const result=validateSpan(source,span);if(!result.ok)return null;size+=result.text.length;if(size>8000)return null;
    excerpts.push({span,text:result.text});
  }
  return {question:qa.question,answer:qa.answer,excerpts,source_revision:source.source_revision,
    rules_version:arm==='R2'?'s47.redact.v1':arm==='R0'?'r0-no-redaction/1':'r1-regex-only/1',profile_id:'s47.synthetic.v1'};
}
export async function evaluateSession(input: EvaluationInput, id: string): Promise<{ rows: ResultRow[]; failures: FailureRow[] }> {
  const rows:ResultRow[]=[];const failures:FailureRow[]=[];
  const sourceText=(s:{turn_id:string;start:number;end:number})=>{const t=input.session.turns.find(t=>t.id===s.turn_id);if(!t||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>t.text.length||s.end<=s.start)throw new Error('invalid_gold_span');return t.text.slice(s.start,s.end);};
  const cases = [
    ...input.targets.map(target=>({track:'controlled',target,turns:[{id:'t1',role:'user' as const,text:sourceText(input.question)},
      {id:'t2',role:'assistant' as const,text:target.spans.map(sourceText).join('\n\n')}],identifiers:input.identifiers.filter(i=>target.slot_ids.includes(i.id)),anchors:target.anchors})),
    {track:'end_to_end',target:null,turns:input.session.turns,identifiers:input.identifiers,anchors:input.targets.flatMap(t=>t.anchors)},
  ];
  for (const item of cases) for (const arm of ['R0','R1','R2'] as const) {
    const source=await armSource(item.turns,arm);
    let qa:QaCandidate|null=null;
    if(source && item.track==='controlled') {
      const user=source.turns[0]!,assistant=source.turns[1]!;
      const q=splitBlocks(user.text),a=splitBlocks(assistant.text);
      const cite=(b:{kind:'sentence'|'code';text:string;start:number;end:number},turn_id:string):QaBlock=>({kind:b.kind,text:b.text,spans:[{turn_id,start:b.start,end:b.end,source_revision:source.source_revision}]});
      if(q.ok&&a.ok&&q.blocks[0])qa={question:cite(q.blocks[0],user.id),answer:a.blocks.map(b=>cite(b,assistant.id)),source_revision:source.source_revision};
    } else if(source) {const selected=extractiveCore(source);if(selected.ok)qa=selected.candidate;}
    const artifact=source&&qa?content(source,qa,arm):null;
    const bytes=artifact?serializeCore(artifact):null;
    const grounding=source&&qa?checkCandidate(source,qa):null;
    const scan=arm==='R2'&&artifact&&bytes?await scanArtifact(artifact,bytes):null;
    const eligible=!!artifact&&!!bytes&&grounding?.ok===true&&(arm!=='R2'||scan?.ok===true);
    for(const format of ['md','json'] as const) {
      const surface=bytes?new TextDecoder().decode(bytes[format]):'';
      const residual=new Set(leakedIds(surface,item.identifiers));
      const retained=item.anchors.filter(a=>source?.turns.some(t=>t.text.includes(a))).length;
      const covered=item.anchors.filter(a=>surface.includes(a)).length;
      const allSpans=qa?[qa.question,...qa.answer].flatMap(b=>[...b.spans]):[];
      const spanValid=source?allSpans.filter(s=>validateSpan(source,s).ok).length:0;
      const goldTurns=new Set(item.track==='controlled'?['t2']:input.targets.flatMap(t=>t.spans.map(s=>s.turn_id)));
      const goldHit=qa?.answer.some(b=>b.spans.some(s=>goldTurns.has(s.turn_id)))?1:0;
      const utility=artifactTrace(JSON.stringify([id,item.track,item.target?.id??null,arm,format]),{
        blocked:!source||!!qa&&!eligible?1:0,abstained:source&&!qa?1:0,downloadable:eligible?1:0,
        anchor_retained_count:retained,anchor_coverage_count:covered,anchor_total:item.anchors.length,valid_span_count:spanValid,span_total:allSpans.length,gold_source_hits:goldHit,gold_source_total:qa?1:0,
        decoy_false_redactions:input.decoys.filter(d=>item.turns.some(t=>t.text.includes(d.value))&&source&&!source.turns.some(t=>t.text.includes(d.value))).length,
      });
      for(const kind of new Set(item.identifiers.map(i=>i.kind))) {
        const planted=item.identifiers.filter(i=>i.kind===kind), missed=planted.filter(i=>residual.has(i.id));
        const key=(i:PlantedIdentifier)=>unitKey(id,i.id);
        rows.push(emptyRow({track:item.track,redaction_arm:arm,selector:item.track==='controlled'?'gold-target':'extractive',format,family:family(kind),class:kind,
          sessions:1,targets:item.track==='controlled'?1:input.targets.length,planted_ids:planted.length,residual_before_gate:missed.length,
          gate_eligible_sessions:eligible?1:0,eligible_ids:eligible?planted.length:0,leaked_ids:eligible?missed.length:0,
          artifact_leak_rate:eligible?rate(missed.length,planted.length):'NA',blocked:!source||!!qa&&!eligible?1:0,abstained:source&&!qa?1:0,downloadable:eligible?1:0,
          session_ids:[id],target_ids:item.target?[unitKey(id,item.target.id)]:input.targets.map(t=>unitKey(id,t.id)),planted_unit_ids:planted.map(key),residual_unit_ids:missed.map(key),eligible_unit_ids:eligible?planted.map(key):[],leaked_unit_ids:eligible?missed.map(key):[],eligible_session_ids:eligible?[id]:[],artifact_traces:[utility],
          anchor_retained_count:retained,anchor_coverage_count:covered,anchor_total:item.anchors.length,valid_span_count:spanValid,span_total:allSpans.length,gold_source_hits:goldHit,gold_source_total:qa?1:0,
          anchor_retention:source?rate(retained,item.anchors.length):'NA',anchor_coverage:bytes?rate(covered,item.anchors.length):'NA',span_validity:rate(spanValid,allSpans.length),gold_source_turn_hit:qa?goldHit:'NA',
          decoy_false_redactions:utility.decoy_false_redactions,status:eligible?'ok':'NA'}));
        for(const identifier of missed)failures.push({session:id,arm,format,identifier_or_mutation_id:identifier.id,class:kind,placement_trap:'see_template_labels',expected:'redacted',observed:eligible?'leaked':'blocked_residual',stage:item.track,status:eligible?'miss':'blocked',reason:'oracle_value_match'});
      }
    }
    // Boundary metrics are independent of selection or export eligibility.
    if(source)for(const kind of new Set(item.identifiers.map(i=>i.kind))) {
      const planted=item.identifiers.filter(i=>i.kind===kind),misses=leakedIds(source.turns.map(t=>t.text).join('\n'),planted);
      rows.push(emptyRow({track:`${item.track}_redacted_transcript_boundary`,redaction_arm:arm,format:'json',family:family(kind),class:kind,sessions:1,planted_ids:planted.length,
        session_ids:[id],target_ids:[],planted_unit_ids:planted.map(i=>unitKey(id,i.id)),residual_unit_ids:misses.map(slot=>unitKey(id,slot)),eligible_unit_ids:[],leaked_unit_ids:[],eligible_session_ids:[],artifact_traces:[],residual_before_gate:misses.length,status:'ok'}));
    }
    if(source&&qa&&grounding?.ok)for(const mutator of MUTATORS){
      const changed=mutator.mutate(qa,source);if(!changed)continue;
      const caught=!checkCandidate(source,changed).ok;
      rows.push(emptyRow({track:'grounding_mutators',redaction_arm:arm,mutator:mutator.id,sessions:1,session_ids:[id],mutations_total:1,mutations_caught:Number(caught),status:'ok'}));
      if(caught!==mutator.expectedCaught)failures.push({session:id,arm,format:'both',identifier_or_mutation_id:mutator.id,class:'mutation',placement_trap:'sentence',expected:mutator.expectedCaught?'caught':'known_miss',observed:caught?'caught':'not_caught',stage:'grounding',status:'diagnostic',reason:'lexical_gate'});
    }
  }
  return {rows,failures};
}
