import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { generate } from '../src/lib/fixtures/generate.ts';
import { materialiseLabels } from '../src/lib/fixtures/labels.ts';
import type { TemplateLabels } from '../src/lib/fixtures/labels.ts';
import { DECOYS } from '../src/lib/fixtures/slots.ts';
import { manifestHashFromDirectory, sha256, normaliseLf } from '../src/lib/fixtures/manifestHash.ts';
import { evaluateSession } from '../src/lib/leakeval/tracks.ts';
import type { EvaluationInput, FailureRow } from '../src/lib/leakeval/tracks.ts';
import { aggregate } from '../src/lib/evalkit/cluster.ts';
import { markdownResults } from '../src/lib/evalkit/split.ts';
import type { ResultRow, RunKind } from '../src/lib/evalkit/counts.ts';
import { evaluateModelDiagnostics } from '../src/lib/leakeval/modelTracks.ts';
export interface HeldoutPaths { receipt:string; templates:string; materialised:string; labels:string; oracle:string; devTemplates:string }
export async function requireAdmission(paths:HeldoutPaths) {
  const receipt:unknown=JSON.parse(await readFile(paths.receipt,'utf8'));
  if(!receipt||typeof receipt!=='object')throw new Error('admission_required');
  const r=receipt as Record<string,unknown>;
  const builders=Array.isArray(r.builder)?r.builder:typeof r.builder==='string'?r.builder.split(','):[];
  if(r.decision!=='GO'||typeof r.custodian!=='string'||!r.custodian||!builders.length||builders.includes(r.custodian)||!r.custodian_model_family||!r.checked_at||!Array.isArray(r.checks))throw new Error('admission_required');
  const checks=r.checks as {id:string;passed:boolean}[];
  const required=['independent_author','model_family','template_disjoint','literal_disjoint','all_classes','tracked_scan','template_hash','label_hash','oracle_examples','human_provenance_review',
    ...['secrets','contact','network','people','ids'].map(f=>'family_'+f),...['superseded_answer','dead_end','excluded_tool_details','target_inline'].map(t=>'trap_'+t),
    ...['EMAIL','PHONE','GH_PAT','AWS_KEY_ID','AWS_SECRET','OPENAI_KEY','SLACK_TOKEN','JWT','PEM_BLOCK','BEARER','BASIC_AUTH_URL','TOKEN_QUERY_URL','CONN_STRING','INTERNAL_HOST','IPV4','IPV6','WIN_HOME','UNIX_HOME','HANDLE','SIG_NAME','PROSE_NAME','UUID','HIGH_ENTROPY'].map(c=>'coverage_'+c)];
  if(checks.some(c=>!c||c.passed!==true)||required.some(id=>!checks.some(c=>c.id===id&&c.passed===true)))throw new Error('admission_checks_incomplete');
  const expected:Record<string,string>={heldout_templates_sha256:await manifestHashFromDirectory(paths.templates),heldout_materialised_sha256:await manifestHashFromDirectory(paths.materialised),
    heldout_labels_sha256:await manifestHashFromDirectory(paths.labels),oracle_examples_sha256:await sha256(normaliseLf(await readFile(paths.oracle))),dev_templates_sha256:await manifestHashFromDirectory(paths.devTemplates)};
  for(const [key,value] of Object.entries(expected))if(r[key]!==value)throw new Error('admission_hash_mismatch');
  return expected;
}
export async function devInputs(manifestPath:string,readText:(path:string)=>Promise<string>=path=>readFile(path,'utf8')):Promise<{id:string;input:EvaluationInput}[]> {
  const root=dirname(resolve(manifestPath));
  const manifest=JSON.parse(await readText(manifestPath)) as {lineage:string;entries:{id:string;template:string;labels:string;seeds:number[]}[]};
  if(manifest.lineage!=='builder-dev'||manifest.entries.length!==10||manifest.entries.some(e=>e.seeds.length!==2))throw new Error('dev_manifest_shape');
  const out:{id:string;input:EvaluationInput}[]=[];
  const child=(path:string)=>{const p=resolve(root,path),rel=relative(root,p);if(!rel||isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw new Error('manifest_path_escape');return p;};
  for(const entry of manifest.entries){const template=await readText(child(entry.template)),labels=JSON.parse(await readText(child(entry.labels))) as TemplateLabels;
    for(const seed of entry.seeds){const generated=generate(template,seed),gold=materialiseLabels(labels,generated);
      out.push({id:entry.id+':'+seed,input:{session:generated.session,identifiers:generated.slots.filter(s=>!DECOYS.includes(s.kind)),decoys:generated.slots.filter(s=>DECOYS.includes(s.kind)),question:gold.gold_question,targets:gold.controlled_targets}});
    }
  }
  return out;
}
export function highTierStop(rows:readonly ResultRow[]):boolean{
  return rows.some(r=>r.redaction_arm==='R2'&&r.family==='secrets'&&(r.leaked_ids>0||(r.track.endsWith('_boundary')&&r.residual_before_gate>0)));
}
export async function heldoutRunProvenance(firstRun:boolean,diagnosticOf:string|undefined,admissionFingerprint:string):Promise<{run_kind:RunKind;first_run_reference?:string}>{
  if(firstRun===!!diagnosticOf)throw new Error('heldout_run_kind_required');
  if(firstRun)return {run_kind:'heldout_first_run'};
  const text=await readFile(resolve(diagnosticOf!,'run.json'),'utf8');
  const first=JSON.parse(text) as {run_kind:string;admission_fingerprint:string};
  if(first.run_kind!=='heldout_first_run'||first.admission_fingerprint!==admissionFingerprint)throw new Error('first_run_reference_mismatch');
  return {run_kind:'known_set_diagnostic',first_run_reference:'sha256:'+await sha256(text)};
}
export async function runEvaluation(inputs:readonly {id:string;input:EvaluationInput}[],meta:{split:'dev'|'heldout';edition:string;codeSha:string;preregSha:string;runKind?:RunKind;firstRunReference?:string}) {
  if(meta.split==='heldout'&&(!meta.runKind||meta.runKind==='dev_diagnostic'||meta.runKind==='known_set_diagnostic'&&!meta.firstRunReference))throw new Error('heldout_run_kind_required');
  const rows:ResultRow[]=[],failures:FailureRow[]=[];
  for(const item of inputs){const result=await evaluateSession(item.input,item.id),model=await evaluateModelDiagnostics(item.input,item.id);
    rows.push(...[...result.rows,...model.rows].map(r=>({...r,split:meta.split,edition:meta.edition,code_sha:meta.codeSha,prereg_sha:meta.preregSha,run_kind:meta.runKind??'dev_diagnostic',first_run_reference:meta.firstRunReference})));failures.push(...result.failures,...model.failures);}
  return {rows:[...aggregate(rows),...aggregate(rows.filter(r=>r.class!=='all'),true)],failures};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try{
    const args=new Map<string,string>();let heldout=false,firstRun=false;
    const allowed=new Set(['--receipt','--templates','--materialised','--labels','--oracle','--dev-templates','--bundle','--edition','--out','--manifest','--known-set-diagnostic']);
    for(let i=2;i<process.argv.length;i++){const key=process.argv[i]!;if(key==='--mock')continue;if(key==='--heldout'){heldout=true;continue;}if(key==='--first-heldout-run'){if(firstRun)throw new Error('invalid_arguments');firstRun=true;continue;}const value=process.argv[++i];if(!allowed.has(key)||!value||value.startsWith('--')||args.has(key))throw new Error('invalid_arguments');args.set(key,value);}
    const value=(key:string)=>{const v=args.get(key);if(!v)throw new Error('missing_argument');return v;};
    const preregSha=await sha256(await readFile('evaluation/prereg.json'));
    const codeSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw new Error('clean_frozen_code_required');
    let inputs:{id:string;input:EvaluationInput}[],provenance:{run_kind:RunKind;first_run_reference?:string}={run_kind:'dev_diagnostic'},admissionFingerprint:string|undefined;
    if(heldout){
      const paths={receipt:value('--receipt'),templates:value('--templates'),materialised:value('--materialised'),labels:value('--labels'),oracle:value('--oracle'),devTemplates:value('--dev-templates')};
      const admitted=await requireAdmission(paths);admissionFingerprint=await sha256(JSON.stringify(admitted));
      provenance=await heldoutRunProvenance(firstRun,args.get('--known-set-diagnostic'),admissionFingerprint);
      // Materialised evaluation bundles are authored by the custodian. Never generate a hidden split here.
      const bundlePath=resolve(value('--bundle')),root=resolve(paths.materialised);
      const bundleRelative=relative(root,bundlePath);
      if(!bundleRelative||isAbsolute(bundleRelative)||bundleRelative==='..'||bundleRelative.startsWith('..'+sep))throw new Error('bundle_outside_admitted_set');
      inputs=JSON.parse(await readFile(bundlePath,'utf8')) as typeof inputs;
      if(!Array.isArray(inputs)||!inputs.length)throw new Error('invalid_bundle');
    } else {if(firstRun||args.has('--known-set-diagnostic'))throw new Error('heldout_run_flag_on_dev');inputs=await devInputs(args.get('--manifest')??'fixtures/dev/MANIFEST.json');}
    const edition=heldout?value('--edition'):'dev-builder-v1';
    const out=resolve(args.get('--out')??'results/run');await mkdir(out,{recursive:false});
    const result=await runEvaluation(inputs,{split:heldout?'heldout':'dev',edition,codeSha,preregSha,runKind:provenance.run_kind,firstRunReference:provenance.first_run_reference});
    await writeFile(resolve(out,'results.jsonl'),result.rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
    await writeFile(resolve(out,'results.md'),markdownResults(result.rows),{flag:'wx'});
    await writeFile(resolve(out,'failures.jsonl'),result.failures.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
    await writeFile(resolve(out,'run.json'),JSON.stringify({...provenance,edition,code_sha:codeSha,prereg_sha:preregSha,admission_fingerprint:admissionFingerprint},null,2)+'\n',{flag:'wx'});
    const stop=highTierStop(result.rows);
    console.log(stop?'STOP: high-tier leak; no live run or reveal.':'Evaluation written; inspect counts, named misses and deferred checks.');if(stop)process.exitCode=1;
  }catch{console.error('evaluation_refused_or_failed');process.exitCode=2;}
}
