import type {EvaluationInput,FailureRow} from './tracks.ts';
import type {PlantedIdentifier} from './oracle.ts';
import {leakedIds} from './oracle.ts';
import {redactSession,isRedactedSession} from '../redactkit/index.ts';
import type {RedactedSession} from '../redactkit/brand.ts';
import {buildModelInput} from '../select/modelInput.ts';
import {mockProvider} from '../providers/mock.ts';
import {requestBody} from '../providers/prompt.ts';
import {SIMULATIONS,simulate,simulationIdentifiers} from '../select/simulated.ts';
import type {QaCandidate} from '../select/types.ts';
import {checkCandidate} from '../spanground/index.ts';
import {validateSpan} from '../spans/validate.ts';
import {serializeCore} from '../artifact/core.ts';
import type {ArtifactContent} from '../artifact/core.ts';
import {scanArtifact} from '../artifact/scan.ts';
import {artifactTrace,emptyRow,rate,unitKey} from '../evalkit/counts.ts';
import type {ResultRow} from '../evalkit/counts.ts';
function family(kind:string):string{return ['EMAIL','PHONE'].includes(kind)?'contact':['IPV4','IPV6','INTERNAL_HOST'].includes(kind)?'network':['WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME'].includes(kind)?'people_places':kind==='UUID'?'ids':kind==='all'?'all':'secrets';}
/** JSON tuples avoid collisions even when a session id contains separators. No value surfaces enter keys. */
const unit=unitKey;
const targetKeys=(input:EvaluationInput,id:string):string[]=>[...new Set(input.targets.map(t=>unit(id,t.id)))];
function trace(id:string,input:EvaluationInput,planted:readonly PlantedIdentifier[],misses:readonly PlantedIdentifier[],eligible:boolean){
 return {session_ids:[id],target_ids:targetKeys(input,id),planted_unit_ids:planted.map(p=>unit(id,p.id)),residual_unit_ids:misses.map(p=>unit(id,p.id)),
 eligible_session_ids:eligible?[id]:[],eligible_unit_ids:eligible?planted.map(p=>unit(id,p.id)):[],leaked_unit_ids:eligible?misses.map(p=>unit(id,p.id)):[]};
}
function failuresFor(id:string,track:string,arm:string,format:string,misses:readonly PlantedIdentifier[],eligible:boolean,mutator:string):FailureRow[]{
 return misses.map(identifier=>({session:id,arm,format,identifier_or_mutation_id:identifier.id,class:identifier.kind,placement_trap:mutator||'selected_model_candidate',
 expected:'redacted',observed:eligible?'leaked':'blocked_residual',stage:track,status:eligible?'miss':'blocked',reason:'oracle_value_match'}));
}
function anchorMetrics(input:EvaluationInput,session:RedactedSession,selectedText:string,answerTurnIds:readonly string[]){
 const anchors=input.targets.flatMap(t=>t.anchors),source=session.turns.map(t=>t.text).join('\n');
 const goldTurns=[...new Set(input.targets.flatMap(t=>t.spans.map(s=>s.turn_id)))];
 const retained=anchors.filter(a=>source.includes(a)).length,covered=anchors.filter(a=>selectedText.includes(a)).length,hits=goldTurns.filter(t=>answerTurnIds.includes(t)).length;
 return {anchor_retained_count:retained,anchor_coverage_count:covered,anchor_total:anchors.length,anchor_retention:rate(retained,anchors.length),anchor_coverage:rate(covered,anchors.length),
 gold_source_hits:hits,gold_source_total:goldTurns.length,gold_source_turn_hit:rate(hits,goldTurns.length)};
}
/** Evaluation only: invalid citations remain in candidate bytes, but never confer eligibility. */
async function candidateRows(input:EvaluationInput,id:string,session:RedactedSession,candidate:QaCandidate|null,identifiers:readonly PlantedIdentifier[],track:string,mode:'mock'|'simulated',mutator:string):Promise<{rows:ResultRow[];failures:FailureRow[]}>{
 let validExcerpts=true,total=0;
 const excerpts:ArtifactContent['excerpts'][number][]=[],seen=new Set<string>();
 const spans=candidate?[candidate.question,...candidate.answer].flatMap(b=>[...b.spans]):[];
 const validSpans=spans.filter(s=>validateSpan(session,s).ok).length;
 if(candidate)for(const span of spans){
 const key=JSON.stringify(span);if(seen.has(key))continue;seen.add(key);
 const checked=validateSpan(session,span);if(!checked.ok){validExcerpts=false;continue;}
 total+=checked.text.length;if(total>8000){validExcerpts=false;continue;}excerpts.push({span,text:checked.text});
 }
 const content:ArtifactContent|null=candidate?{question:candidate.question,answer:candidate.answer,excerpts,rules_version:session.rules_version,profile_id:'s47.synthetic.v1',source_revision:session.source_revision}:null;
 const bytes=content?serializeCore(content):null,grounding=candidate?checkCandidate(session,candidate):null,scan=content&&bytes?await scanArtifact(content,bytes):null;
 const eligible=!!candidate&&validExcerpts&&grounding?.ok===true&&scan?.ok===true;
 const metrics:Partial<ResultRow>=candidate?anchorMetrics(input,session,candidate.answer.map(b=>b.text).join('\n'),candidate.answer.flatMap(b=>b.spans.filter(s=>validateSpan(session,s).ok).map(s=>s.turn_id))):{};
 const rows:ResultRow[]=[],failures:FailureRow[]=[];
 for(const format of ['md','json'] as const){
 const surface=bytes?new TextDecoder().decode(bytes[format]):'',leaks=new Set(leakedIds(surface,identifiers));
 const utility=artifactTrace(JSON.stringify([id,track,mode,mutator,format]),{blocked:candidate&&!eligible?1:0,abstained:candidate?0:1,downloadable:eligible?1:0,
 anchor_retained_count:metrics.anchor_retained_count,anchor_coverage_count:metrics.anchor_coverage_count,anchor_total:metrics.anchor_total,
 gold_source_hits:metrics.gold_source_hits,gold_source_total:metrics.gold_source_total,valid_span_count:candidate?validSpans:undefined,span_total:candidate?spans.length:undefined});
 for(const kind of identifiers.length?new Set(identifiers.map(i=>i.kind)):['all']){
 const planted=identifiers.filter(i=>i.kind===kind),misses=planted.filter(i=>leaks.has(i.id)),arm=mode==='simulated'?'R3':'R2';
 rows.push(emptyRow({track,redaction_arm:arm,selector:mode==='simulated'?'simulated-adversarial':'mock-model',mode,mutator,format,family:family(kind),class:kind,sessions:1,targets:input.targets.length,planted_ids:planted.length,
 ...trace(id,input,planted,misses,eligible),artifact_traces:[utility],...metrics,residual_before_gate:misses.length,gate_eligible_sessions:eligible?1:0,eligible_ids:eligible?planted.length:0,leaked_ids:eligible?misses.length:0,artifact_leak_rate:eligible?rate(misses.length,planted.length):'NA',
 blocked:candidate&&!eligible?1:0,abstained:candidate?0:1,downloadable:eligible?1:0,valid_span_count:candidate?validSpans:undefined,span_total:candidate?spans.length:undefined,span_validity:candidate?rate(validSpans,spans.length):'NA',
 provider:'mock',model:mode==='simulated'?'simulated':'extractive-mock',status:eligible?'ok':'NA'}));
 failures.push(...failuresFor(id,track,arm,format,misses,eligible,mutator));
 }
 }
 return {rows,failures};
}
export async function evaluateModelDiagnostics(input:EvaluationInput,id:string):Promise<{rows:ResultRow[];failures:FailureRow[]}>{
 if(!id)throw new Error('session_id_required');
 const session=await redactSession(input.session);
 if(!isRedactedSession(session))return {rows:[...new Set(input.identifiers.map(i=>i.kind))].map(kind=>{const planted=input.identifiers.filter(i=>i.kind===kind);return emptyRow({track:'redacted_request_boundary',selector:'model-input',family:family(kind),class:kind,sessions:1,targets:input.targets.length,planted_ids:planted.length,...trace(id,input,planted,[],false),artifact_traces:[artifactTrace(unit(id,'request-boundary'),{blocked:1})],blocked:1,status:'NA'});}),failures:[]};
 const selection=buildModelInput(session);
 if(!selection.ok)return {rows:[...new Set(input.identifiers.map(i=>i.kind))].map(kind=>{const planted=input.identifiers.filter(i=>i.kind===kind);return emptyRow({track:'redacted_request_boundary',selector:'model-input',family:family(kind),class:kind,sessions:1,targets:input.targets.length,planted_ids:planted.length,...trace(id,input,planted,[],false),artifact_traces:[artifactTrace(unit(id,'request-boundary'),{abstained:1})],abstained:1,status:'NA'});}),failures:[]};
 // Denominator includes only ids originally planted in selected turns, plus any deliberate R3 injection.
 const selectedRaw=input.session.turns.filter(t=>selection.input_turn_ids.includes(t.id)).map(t=>t.text).join('\n');
 const included=new Set(leakedIds(selectedRaw,input.identifiers)),identifiers=input.identifiers.filter(i=>included.has(i.id));
 const body=requestBody(selection.request,'anthropic','claude-sonnet-4-5-20250929'),boundaryLeaks=new Set(leakedIds(body,identifiers)),rows:ResultRow[]=[],failures:FailureRow[]=[];
 const boundaryMetrics=anchorMetrics(input,session,selection.request.turns.map(t=>t.text).join('\n'),selection.input_turn_ids);
 for(const kind of identifiers.length?new Set(identifiers.map(i=>i.kind)):['all']){
 const planted=identifiers.filter(i=>i.kind===kind),misses=planted.filter(i=>boundaryLeaks.has(i.id));
 rows.push(emptyRow({track:'redacted_request_boundary',selector:'model-input',format:'json',family:family(kind),class:kind,sessions:1,targets:input.targets.length,planted_ids:planted.length,...trace(id,input,planted,misses,true),...boundaryMetrics,artifact_traces:[artifactTrace(unit(id,'request-boundary'),{anchor_retained_count:boundaryMetrics.anchor_retained_count,anchor_coverage_count:boundaryMetrics.anchor_coverage_count,anchor_total:boundaryMetrics.anchor_total,gold_source_hits:boundaryMetrics.gold_source_hits,gold_source_total:boundaryMetrics.gold_source_total})],residual_before_gate:misses.length,
 gate_eligible_sessions:1,eligible_ids:planted.length,leaked_ids:misses.length,artifact_leak_rate:rate(misses.length,planted.length),downloadable:0,provider:'mock',model:'no-transport-boundary',status:'ok'}));
 failures.push(...failuresFor(id,'redacted_request_boundary','R2','json',misses,true,'request_boundary'));
 }
 const mock=await mockProvider.complete(selection.request),mockResult=await candidateRows(input,id,session,mock.ok?mock.candidate:null,identifiers,'model_end_to_end','mock','');
 rows.push(...mockResult.rows);failures.push(...mockResult.failures);
 for(const mode of SIMULATIONS){const simulated=simulate(session,mode),extra=simulationIdentifiers(mode);
 const result=await candidateRows(input,id,session,'candidate' in simulated?simulated.candidate:null,[...input.identifiers,...extra],'simulated_adversarial','simulated',mode);
 rows.push(...result.rows);failures.push(...result.failures);}
 return {rows,failures};
}
export async function evaluateModelBoundaries(input:EvaluationInput,id:string):Promise<ResultRow[]>{return (await evaluateModelDiagnostics(input,id)).rows;}
