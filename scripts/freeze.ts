import { execFileSync } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normaliseLf, sha256 } from '../src/lib/fixtures/manifestHash.ts';
export const SOURCE_SNAPSHOT_ALGORITHM='s47.source-snapshot.v1';
function validPath(path:string):boolean{
  return !!path&&!path.startsWith('/')&&!/^[A-Za-z]:/.test(path)&&!/[\\\r\n]/.test(path)&&!path.split('/').some(part=>!part||part==='.'||part==='..');
}
async function sourceBytes(root:string,path:string):Promise<Uint8Array>{
  if(!validPath(path))throw new Error('invalid_source_path');
  let file=root;const parts=path.split('/');
  for(const [i,part]of parts.entries()){
    file=join(file,part);const stat=await lstat(file);
    if(i===parts.length-1?!stat.isFile():!stat.isDirectory())throw new Error('source_not_regular_file');
  }
  return readFile(file);
}
export async function freezeSource(root:string) {
  const git=(args:string[],input?:string)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',input,stdio:'pipe'});
  root=resolve(git(['rev-parse','--show-toplevel']).replace(/\r?\n$/,''));
  if(git(['status','--porcelain']).trim())throw new Error('clean_code_required');
  const frozen=JSON.parse(normaliseLf(await sourceBytes(root,'src/lib/baselines/FREEZE.json'))) as {files:Record<string,string>};
  for(const [file,hash]of Object.entries(frozen.files))if(await sha256(await sourceBytes(root,file))!==hash)throw new Error('baseline_changed');
  // NUL-delimited Git paths preserve names; every tracked file in these trees is bound, without suffix exemptions.
  const paths=git(['ls-files','-z']).split('\0').filter(path=>/^(src|scripts|supabase|fixtures|tests)\//.test(path));
  if(!paths.length)throw new Error('empty_source_snapshot');
  if(paths.some(path=>!validPath(path))||new Set(paths).size!==paths.length)throw new Error('invalid_source_path');
  paths.sort((a,b)=>Buffer.compare(Buffer.from(a,'utf8'),Buffer.from(b,'utf8')));
  // Only an explicit indexed Git -text attribute selects raw bytes. Invalid UTF-8 never selects its own fallback.
  const attributes=git(['check-attr','--cached','-z','--stdin','text'],paths.join('\0')+'\0').split('\0');
  if(attributes.pop()!==''||attributes.length!==paths.length*3)throw new Error('source_attributes_incomplete');
  const rawPaths=new Set<string>();
  for(const [i,path]of paths.entries()){
    if(attributes[i*3]!==path||attributes[i*3+1]!=='text')throw new Error('source_attributes_incomplete');
    if(attributes[i*3+2]==='unset')rawPaths.add(path);
  }
  const source_snapshot_files=await Promise.all(paths.map(async path=>{
    const bytes=await sourceBytes(root,path),raw_sha256=await sha256(bytes),encoding=rawPaths.has(path)?'raw-bytes' as const:'utf8-lf' as const;
    let canonical:Uint8Array|string=bytes;
    if(encoding==='utf8-lf'){
      try{canonical=normaliseLf(bytes);}catch{throw new Error('source_text_not_utf8');}
    }
    return {path,encoding,raw_sha256,sha256:await sha256(canonical)};
  }));
  const manifest=SOURCE_SNAPSHOT_ALGORITHM+'\n'+source_snapshot_files.map(file=>JSON.stringify([file.path,file.encoding,file.raw_sha256,file.sha256])+'\n').join('');
  // Retain the existing live-dev consumer contract: its recipes, labels and manifest are UTF-8/LF text digests.
  const source_files=source_snapshot_files.map(({path,sha256})=>({path,sha256}));
  return {status:'source_snapshot_only',runtime:'unverified',code_sha:git(['rev-parse','HEAD']).trim(),source_snapshot_algorithm:SOURCE_SNAPSHOT_ALGORITHM,
    source_manifest_sha256:await sha256(manifest),source_snapshot_files,source_files,
    prereg_sha256:await sha256(await sourceBytes(root,'evaluation/prereg.json')),baseline_hashes:frozen.files,
    heldout:'PENDING — needs Roy to appoint',tag_created:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const root=resolve(process.argv[2]??'.');await writeFile(resolve(root,'evaluation/freeze.json'),JSON.stringify(await freezeSource(root),null,2)+'\n',{flag:'wx'});
    console.log('Source snapshot written. No evaluation tag or runtime acceptance created.');}
  catch{console.error('freeze_refused');process.exitCode=2;}
}
