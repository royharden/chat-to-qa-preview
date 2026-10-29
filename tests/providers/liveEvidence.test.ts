import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {requireOfflinePass,reviewedDenyList,prepareLiveSession,finishLiveProposal} from '../../scripts/live-eval.ts';
import {normaliseLf,sha256} from '../../src/lib/fixtures/manifestHash.ts';
import {mockProvider} from '../../src/lib/providers/mock.ts';

async function publicDevSnapshot(root:string){
 const paths=['fixtures/dev/MANIFEST.json',...Array.from({length:10},(_,i)=>{
  const id='dev-'+String(i+1).padStart(2,'0');return ['fixtures/dev/'+id+'.md.tmpl','fixtures/dev/'+id+'.labels.json'];
 }).flat()];
 return {source_files:await Promise.all(paths.map(async path=>({path,sha256:await sha256(normaliseLf(await readFile(resolve(root,path))))})))};
}
describe('live prerequisite evidence',()=>{
 it('refuses fabricated pass receipts before any provider path',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'s47-evidence-')),e=join(dir,'e.json'),f=join(dir,'f.json');
 try{await writeFile(e,JSON.stringify({kind:'not-an-execution-receipt'}));await writeFile(f,'{}');
 await expect(requireOfflinePass(e,f,process.cwd())).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
 });
 // what_bug_this_catches: provider-send confirmation silently substituted for the separate explicit names review.
 it('requires exactly one names-review action and rejects an implicit or supplied empty list',()=>{
  expect(()=>reviewedDenyList(false,undefined)).toThrow('names_review_required');
  expect(()=>reviewedDenyList(true,['Fixture Person'])).toThrow('names_review_required');
  expect(()=>reviewedDenyList(false,[])).toThrow('reviewed_names_invalid');
  expect(reviewedDenyList(true,undefined)).toEqual([]);
  expect(reviewedDenyList(false,[' Fixture Person ','Fixture Person'])).toEqual(['Fixture Person']);
 });
 it('refuses missing names review or external dev input in the pre-provider preparation stage',async()=>{
  const root=process.cwd(),external=resolve(root,'..','external-dev-MANIFEST.json');
  const options={root,manifestPath:external,frozen:{source_files:[]},sessionId:'irrelevant',noNames:false};
  await expect(prepareLiveSession(options)).rejects.toThrow('names_review_required');
  await expect(prepareLiveSession({...options,noNames:true})).rejects.toThrow('frozen_dev_manifest_required');
 });
 // what_bug_this_catches: an unrelated/changed manifest used to bypass the offline source evidence binding.
 it('refuses a changed in-repo manifest before reading recipes, redacting or returning any provider request',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s47-frozen-dev-')),file=join(root,'fixtures','dev','MANIFEST.json');
  try{
   await mkdir(join(root,'fixtures','dev'),{recursive:true});
   const frozen={source_files:[{path:'fixtures/dev/MANIFEST.json',sha256:await sha256('{}')} ]};
   await writeFile(file,'{"changed":true}');
   await expect(prepareLiveSession({root,manifestPath:file,frozen,sessionId:'irrelevant',noNames:true})).rejects.toThrow('frozen_dev_file_changed');
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('also binds a consumed recipe to the frozen digest rather than only checking the manifest path',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s47-frozen-recipe-')),dir=join(root,'fixtures','dev'),manifestPath=join(dir,'MANIFEST.json');
  try{
   await mkdir(dir,{recursive:true});
   const manifest=JSON.stringify({lineage:'builder-dev',entries:Array.from({length:10},(_,i)=>{
    const id='dev-'+String(i+1).padStart(2,'0');return {id,template:id+'.md.tmpl',labels:id+'.labels.json',seeds:[1,2]};
   })});
   await writeFile(manifestPath,manifest);await writeFile(join(dir,'dev-01.md.tmpl'),'changed recipe source');
   const frozen={source_files:[{path:'fixtures/dev/MANIFEST.json',sha256:await sha256(manifest)},{path:'fixtures/dev/dev-01.md.tmpl',sha256:await sha256('original recipe source')}]};
   await expect(prepareLiveSession({root,manifestPath,frozen,sessionId:'dev-01:1',noNames:true})).rejects.toThrow('frozen_dev_file_changed');
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('passes reviewed terms through redaction and the final proposal rescan',async()=>{
  const root=process.cwd(),frozen=await publicDevSnapshot(root),manifestPath=resolve(root,'fixtures/dev/MANIFEST.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as {entries:{id:string;seeds:number[]}[]};
  const first=manifest.entries[0]!,sessionId=first.id+':'+first.seeds[0];
  const prepared=await prepareLiveSession({root,manifestPath,frozen,sessionId,noNames:false,reviewedNames:['obsolete fast profile']});
  expect(prepared.denyList).toEqual(['obsolete fast profile']);
  expect(prepared.session.turns.some(t=>t.text.includes('obsolete fast profile'))).toBe(false);
  const candidate=await mockProvider.complete(prepared.request);if(!candidate.ok)throw new Error('mock_selection_required');
  await expect(finishLiveProposal(prepared,candidate.candidate)).resolves.toHaveProperty('md_sha256');
  // A reviewed term reintroduced by a model must still be caught at the final serialization boundary.
  const deniedText=candidate.candidate.answer[0]!.text;
  await expect(finishLiveProposal({...prepared,denyList:[deniedText]},candidate.candidate)).rejects.toThrow('rescan_blocked');
 });
});
