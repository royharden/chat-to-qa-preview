import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {freezeSource} from './freeze.ts';
import {devInputs} from './eval.ts';
import {cliLedger,PROVIDER_NOTICE} from './cli-ledger.ts';
import {approvedPrice} from '../src/lib/callledger/prices.ts';
import {capUsd} from '../src/lib/callledger/reserve.ts';
import {redactSession,isRedactedSession} from '../src/lib/redactkit/index.ts';
import {buildModelInput} from '../src/lib/select/modelInput.ts';
import {anthropicProvider} from '../src/lib/providers/anthropic.ts';
import {checkCandidate} from '../src/lib/spanground/index.ts';
import {serialize} from '../src/lib/artifact/serialize.ts';
import {normaliseLf,sha256} from '../src/lib/fixtures/manifestHash.ts';
import type {RedactedSession} from '../src/lib/redactkit/index.ts';
import type {QaCandidate} from '../src/lib/select/types.ts';
type OfflineEvidence={kind:string;code_sha:string;source_manifest_sha256:string;prereg_sha256:string;dev_high_tier_leaks:number;boundary_pass:boolean;approval_pass:boolean;offline_pass:boolean;reviewed_provider:string;reviewed_model:string;price_table_verified:boolean};
/** An offline evidence file is a human-reviewed execution receipt, never created by this CLI. */
export async function requireOfflinePass(evidenceFile:string,freezeFile:string,root:string){
 const evidence=JSON.parse(await readFile(evidenceFile,'utf8')) as OfflineEvidence,supplied=JSON.parse(await readFile(freezeFile,'utf8')) as Record<string,unknown>,current=await freezeSource(root);
 if(evidence.kind!=='s47.offline-evidence.v1'||!evidence.offline_pass||!evidence.boundary_pass||!evidence.approval_pass||evidence.dev_high_tier_leaks!==0||evidence.reviewed_provider!=='anthropic'||evidence.reviewed_model!=='claude-sonnet-4-5-20250929'||evidence.price_table_verified!==true)throw new Error('offline_pass_required');
 for(const key of ['code_sha','source_manifest_sha256','prereg_sha256'] as const)if(evidence[key]!==current[key]||supplied[key]!==current[key])throw new Error('stale_offline_evidence_or_freeze');
 approvedPrice('anthropic',evidence.reviewed_model);
 return current;
}
type FrozenDevSource=Pick<Awaited<ReturnType<typeof freezeSource>>,'source_files'>;
/** Exactly one explicit names-review action is required independently of provider-send consent. */
export function reviewedDenyList(noNames:boolean,value:unknown):readonly string[]{
 if(noNames===(value!==undefined))throw new Error('names_review_required');
 if(noNames)return Object.freeze([]);
 if(!Array.isArray(value)||!value.length||value.some(term=>typeof term!=='string'||!term.trim()))throw new Error('reviewed_names_invalid');
 return Object.freeze([...new Set((value as string[]).map(term=>term.trim()))]);
}
/** Read the actual frozen in-repo dev recipes; hash each byte string used, not a later reread. */
export async function frozenDevInputs(manifestPath:string,root:string,frozen:FrozenDevSource){
 const base=resolve(root),manifest=resolve(base,'fixtures/dev/MANIFEST.json');
 if(relative(manifest,resolve(manifestPath))!=='')throw new Error('frozen_dev_manifest_required');
 const physicalRoot=await realpath(base),digests=new Map(frozen.source_files.map(file=>[file.path,file.sha256]));
 const allowed=new Set(['fixtures/dev/MANIFEST.json',...Array.from({length:10},(_,i)=>{
  const id='dev-'+String(i+1).padStart(2,'0');return ['fixtures/dev/'+id+'.md.tmpl','fixtures/dev/'+id+'.labels.json'];
 }).flat()]);
 const readFrozenText=async(path:string)=>{
  const file=resolve(path),key=relative(base,file).split(sep).join('/');
  if(!allowed.has(key)||!digests.has(key))throw new Error('frozen_dev_file_required');
  if(relative(resolve(physicalRoot,key),await realpath(file))!=='')throw new Error('frozen_dev_symlink_refused');
  const text=normaliseLf(await readFile(file));
  if(await sha256(text)!==digests.get(key))throw new Error('frozen_dev_file_changed');
  return text;
 };
 return devInputs(manifest,readFrozenText);
}
export async function prepareLiveSession(options:{root:string;manifestPath:string;frozen:FrozenDevSource;sessionId:string;noNames:boolean;reviewedNames?:unknown}){
 const denyList=reviewedDenyList(options.noNames,options.reviewedNames);
 const inputs=await frozenDevInputs(options.manifestPath,options.root,options.frozen);
 const selected=inputs.find(i=>i.id===options.sessionId);if(!selected)throw new Error('dev_session_required');
 const session=await redactSession(selected.input.session,{denyList});if(!isRedactedSession(session))throw new Error('redaction_blocked');
 const request=buildModelInput(session);if(!request.ok)throw new Error('model_input_blocked');
 return {session,request:request.request,denyList};
}
export async function finishLiveProposal(prepared:{session:RedactedSession;denyList:readonly string[]},candidate:QaCandidate){
 if(!checkCandidate(prepared.session,candidate).ok)throw new Error('candidate_grounding_blocked');
 return serialize(prepared.session,candidate,'s47.synthetic.v1',prepared.denyList);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.error(PROVIDER_NOTICE);
 try{
 const args=new Map<string,string>();let confirmed=false,noNames=false;
 const allowed=new Set(['--root','--offline-evidence','--freeze','--ledger','--dev-manifest','--session','--run-id','--operator-id','--reviewed-names']);
 for(let i=2;i<process.argv.length;i++){const k=process.argv[i]!;if(k==='--confirm-provider-send'){if(confirmed)throw new Error('arguments_required');confirmed=true;continue;}if(k==='--no-names'){if(noNames)throw new Error('arguments_required');noNames=true;continue;}const v=process.argv[++i];if(!allowed.has(k)||!v||v.startsWith('--')||args.has(k))throw new Error('arguments_required');args.set(k,v);}
 const arg=(key:string)=>{const v=args.get(key);if(!v)throw new Error('argument_required');return v;};
 if(!confirmed)throw new Error('provider_confirmation_required');
 const namesFile=args.get('--reviewed-names');if(noNames===!!namesFile)throw new Error('names_review_required');
 const reviewedNames=namesFile?JSON.parse(await readFile(namesFile,'utf8')) as unknown:undefined;
 reviewedDenyList(noNames,reviewedNames);
 const root=resolve(arg('--root')),frozen=await requireOfflinePass(arg('--offline-evidence'),arg('--freeze'),root);
 const {session,request,denyList}=await prepareLiveSession({root,manifestPath:arg('--dev-manifest'),frozen,sessionId:arg('--session'),noNames,reviewedNames});
 const apiKey=process.env.S47_ANTHROPIC_API_KEY,cap=capUsd(process.env.S47_CLI_CAP_USD);if(!apiKey)throw new Error('provider_key_absent');
 const ledger=await cliLedger(arg('--ledger'),cap,root);
 const result=await anthropicProvider.complete(request,{apiKey,model:'claude-sonnet-4-5-20250929',request_id:crypto.randomUUID(),run_id:arg('--run-id'),operator_id:arg('--operator-id'),ledger,confirmProviderSend:true});
 if(!result.ok)throw new Error('live_proposal_failed');
 // serializeArtifact performs branded-session excerpts and detector rescans. No approval or public download is created.
 const artifact=await finishLiveProposal({session,denyList},result.candidate);
 console.log(JSON.stringify({status:'proposal_requires_manual_exact_byte_review',approved:false,source_revision:session.source_revision,md_sha256:artifact.md_sha256,json_sha256:artifact.json_sha256,candidate:result.candidate}));
 }catch{console.error('live_evaluation_refused');process.exitCode=2;}
}
