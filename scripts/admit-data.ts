import {readFile} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generate} from '../src/lib/fixtures/generate.ts';
import {materialiseLabels} from '../src/lib/fixtures/labels.ts';
import type {TemplateLabels} from '../src/lib/fixtures/labels.ts';
import {DECOYS} from '../src/lib/fixtures/slots.ts';
import {manifestHash,manifestHashFromDirectory,sha256,normaliseLf} from '../src/lib/fixtures/manifestHash.ts';
import type {ManifestEntry} from '../src/lib/fixtures/manifestHash.ts';
import {secretLines,scanTracked} from './scan-tracked.ts';
type Entry={id:string;template:string;labels:string;seeds:number[]};
type Manifest={edition:string;author:string;provenance:string;lineage:string;entries:Entry[]};
type Check={id:string;passed:boolean;note:string};
export type AdmissionSession={id:string;slots:ReturnType<typeof generate>['slots'];targets:string[];traps:string[]};
export function devShape(manifest:Pick<Manifest,'lineage'|'entries'>,sessionCount:number):boolean{
 return manifest.lineage==='builder-dev'&&manifest.entries.length===10&&manifest.entries.every(e=>e.seeds.length===2)&&sessionCount===20;
}
export type AdmissionOptions={devManifest:string;heldoutManifest?:string;builder:string[];custodian?:string;custodianModelFamily?:string;builderModelFamily?:string;trackedRoot:string;materialised?:string;templates?:string;labels?:string;oracleExamples?:string};
function child(root:string,file:string):string{const p=resolve(root,file),rel=relative(root,p);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('manifest_path_escape');return p;}
async function load(file:string){
 const manifest=JSON.parse(await readFile(file,'utf8')) as Manifest,root=dirname(resolve(file));
 if(manifest.provenance!=='synthetic'||!manifest.author||!manifest.edition||!Array.isArray(manifest.entries)||!manifest.entries.length)throw new Error('invalid_manifest');
 const templates:ManifestEntry[]=[],labels:ManifestEntry[]=[],templateHashes=new Set<string>(),literalHashes=new Set<string>();
 const sessions:AdmissionSession[]=[];
 const seen=new Set<string>();
 for(const e of manifest.entries){
 if(seen.has(e.id)||!e.id||!Array.isArray(e.seeds)||new Set(e.seeds).size!==e.seeds.length||!e.seeds.length)throw new Error('invalid_entry');seen.add(e.id);
 const text=normaliseLf(await readFile(child(root,e.template))),labelText=normaliseLf(await readFile(child(root,e.labels)));
 if(secretLines(text).length||secretLines(labelText).length)throw new Error('materialised_secret');
 const spec=JSON.parse(labelText) as TemplateLabels;
 if(spec.lineage!==manifest.lineage||spec.author!==manifest.author||!text.includes('Author: '+manifest.author))throw new Error('provenance_mismatch');
 templates.push({path:e.template,bytes:text});labels.push({path:e.labels,bytes:labelText});
 templateHashes.add(await sha256(text));
 for(const seed of e.seeds){
 const generated=generate(text,seed),gold=materialiseLabels(spec,generated);
 for(const slot of generated.slots)literalHashes.add(await sha256(slot.value));
 sessions.push({id:e.id+':'+seed,slots:generated.slots,targets:gold.controlled_targets.flatMap(t=>t.slot_ids),traps:spec.traps});
 }
 }
 return {manifest,templateHashes,literalHashes,sessions,templates_sha256:await manifestHash(templates),labels_sha256:await manifestHash(labels)};
}
export function coverageChecks(sessions:AdmissionSession[]):Check[]{
 const checks:Check[]=[],add=(id:string,passed:boolean,note:string)=>checks.push({id,passed,note});
 const classes=new Set(sessions.flatMap(s=>s.slots.filter(v=>!DECOYS.includes(v.kind)).map(v=>v.kind)));
 const required=['EMAIL','PHONE','GH_PAT','AWS_KEY_ID','AWS_SECRET','OPENAI_KEY','SLACK_TOKEN','JWT','PEM_BLOCK','BEARER','BASIC_AUTH_URL','TOKEN_QUERY_URL','CONN_STRING','INTERNAL_HOST','IPV4','IPV6','WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME','UUID','HIGH_ENTROPY'];
 add('all_classes',required.every(c=>classes.has(c as never)),'All planted classes represented.');
 for(const kind of classes){
 const matching=sessions.filter(s=>s.slots.some(v=>v.kind===kind)),values=new Set(matching.flatMap(s=>s.slots.filter(v=>v.kind===kind).map(v=>v.value)));
 const instanceCount=matching.reduce((n,s)=>n+s.slots.filter(v=>v.kind===kind).length,0);
 const targetCount=matching.reduce((n,s)=>n+s.slots.filter(v=>v.kind===kind&&s.targets.includes(v.id)).length,0);
 add('coverage_'+kind,kind==='UUID'?instanceCount>=10&&targetCount>=10:values.size>=20&&matching.length>=8&&targetCount>=10,kind==='UUID'?'At least ten UUID instances and ten controlled placements; counts only below ten.':'At least 20 distinct ids, 8 sessions, 10 controlled placements; counts only below ten.');
 }
 const families:Record<string,string[]>={
 secrets:required.slice(2,13).concat('HIGH_ENTROPY'),contact:['EMAIL','PHONE'],network:['INTERNAL_HOST','IPV4','IPV6'],people:['WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME'],ids:['UUID']};
 for(const [family,kinds]of Object.entries(families)){const count=sessions.reduce((n,s)=>n+s.slots.filter(v=>kinds.includes(v.kind)&&s.targets.includes(v.id)).length,0);add('family_'+family,count>=30,'At least 30 planted instances inside controlled targets.');}
 for(const trap of ['superseded_answer','dead_end','excluded_tool_details','target_inline'])add('trap_'+trap,sessions.filter(s=>s.traps.includes(trap)).length>=10,'At least ten sessions per required hard trap.');
 return checks;
}
export async function admitData(o:AdmissionOptions){
 const checks:Check[]=[],add=(id:string,passed:boolean,note:string)=>checks.push({id,passed,note});
 const dev=await load(o.devManifest);
 add('dev_shape',devShape(dev.manifest,dev.sessions.length),'Ten templates; two seeds each; builder-dev only.');
 add('tracked_scan',scanTracked(o.trackedRoot).length===0,'K21 working/index scan; no content included in report.');
 if(!o.heldoutManifest){add('independent_admission',false,'PENDING: Roy must appoint an independent author.');return {decision:'NO_GO' as const,checks,dev_templates_sha256:dev.templates_sha256};}
 const held=await load(o.heldoutManifest);
 add('independent_author',!!o.custodian&&held.manifest.author===o.custodian&&!o.builder.includes(o.custodian)&&held.manifest.lineage==='independent-heldout','Author identity must differ from every builder-lineage actor.');
 add('model_family',!!o.custodianModelFamily&&!!o.builderModelFamily&&o.custodianModelFamily!==o.builderModelFamily,'Agent authors require a different model family.');
 add('template_disjoint',[...held.templateHashes].every(h=>!dev.templateHashes.has(h)),'Exact LF-normalised template hashes differ.');
 add('literal_disjoint',[...held.literalHashes].every(h=>!dev.literalHashes.has(h)),'Every runtime literal value hash differs.');
 checks.push(...coverageChecks(held.sessions));
 const supplied=!!o.materialised&&!!o.templates&&!!o.labels&&!!o.oracleExamples;
 add('external_sets_supplied',supplied,'Explicit set roots and tiny oracle-example file required.');
 let materialised_sha256:string|undefined,oracle_examples_sha256:string|undefined;
 if(supplied){
 add('template_hash',await manifestHashFromDirectory(o.templates!)===held.templates_sha256,'Supplied template set agrees with manifest.');
 add('label_hash',await manifestHashFromDirectory(o.labels!)===held.labels_sha256,'Supplied label set agrees with manifest.');
 materialised_sha256=await manifestHashFromDirectory(o.materialised!);
 const oracle=normaliseLf(await readFile(o.oracleExamples!));oracle_examples_sha256=await sha256(oracle);
 add('oracle_examples',oracle.length>0,'Custodian-authored oracle examples present; correctness remains human review.');
 }
 add('human_provenance_review',false,'Custodian must attest no external chat corpus, transcript, copied template fragments or prohibited derivation; this tool cannot prove authorship.');
 return {decision:'NO_GO' as const,checks,heldout_templates_sha256:held.templates_sha256,heldout_labels_sha256:held.labels_sha256,heldout_materialised_sha256:materialised_sha256,oracle_examples_sha256,dev_templates_sha256:dev.templates_sha256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
 const args=new Map<string,string>();for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];if(!k?.startsWith('--')||!v||args.has(k))throw new Error('invalid_arguments');args.set(k,v);}
 const devManifest=args.get('--dev-manifest'),trackedRoot=args.get('--tracked-root'),builder=args.get('--builders');
 if(!devManifest||!trackedRoot||!builder)throw new Error('required_arguments_missing');
 const result=await admitData({devManifest,trackedRoot,builder:builder.split(','),heldoutManifest:args.get('--heldout-manifest'),custodian:args.get('--custodian'),custodianModelFamily:args.get('--custodian-model-family'),builderModelFamily:args.get('--builder-model-family'),materialised:args.get('--materialised'),templates:args.get('--templates'),labels:args.get('--labels'),oracleExamples:args.get('--oracle-examples')});
 console.log(JSON.stringify(result,null,2));process.exitCode=1;
 }catch{console.error('admission_incomplete');process.exitCode=2;}
}
