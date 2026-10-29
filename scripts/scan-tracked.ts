import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync} from 'node:fs';
import {join,parse,relative,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
/** Exact K21 SCAN family. Source regexes do not contain materialised test tokens. */
export const SCAN:readonly RegExp[]=[
 /AKIA[0-9A-Z]{16}/,/ASIA[0-9A-Z]{16}/,/ghp_[A-Za-z0-9]{36}/,/github_pat_[A-Za-z0-9_]{22,}/,
 /(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/,/xox[bpas]-[A-Za-z0-9-]{10,}/,
 /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,/-----BEGIN [A-Z ]*PRIVATE KEY-----/,
 /Bearer\s+[A-Za-z0-9._~+/-]{16,}/,
];
export function secretLines(text:string):number[]{return text.split('\n').flatMap((line,i)=>SCAN.some(r=>r.test(line))?[i+1]:[]);}
type ScanHit={path:string;line:number;source:'working'|'index'};
/** Never follow a working-file symlink, including one replacing a tracked parent directory. */
function workingText(root:string,path:string,missingAllowed:boolean):string|undefined{
 const parts=path.split('/');let file=root;
 for(const [i,part]of parts.entries()){
  if(!part||part==='.'||part==='..')throw new Error('scan_incomplete');
  file=join(file,part);
  let stat;
  try{stat=lstatSync(file);}catch(error){
   if(missingAllowed&&typeof error==='object'&&error!==null&&'code'in error&&error.code==='ENOENT')return undefined;
   throw new Error('scan_incomplete');
  }
  if(i===parts.length-1?!stat.isFile():!stat.isDirectory())throw new Error('scan_incomplete');
 }
 return readFileSync(file,'utf8');
}
export function scanTracked(root:string):ScanHit[]{
 try{
  // Capture stderr even on Git failures; no subprocess diagnostic or file content escapes.
  const git=(cwd:string,args:string[])=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const repo=resolve(git(root,['rev-parse','--show-toplevel']).replace(/\r?\n$/,''));
  const names=(args:string[])=>git(repo,args).split('\0').filter(Boolean);
  const entries=names(['ls-files','--stage','-z']).map(record=>{
   const match=/^[0-7]{6} ([0-9a-f]{40}|[0-9a-f]{64}) [0-3]\t([\s\S]+)$/.exec(record);
   if(!match?.[1]||!match[2])throw new Error('scan_incomplete');
   return {object:match[1],path:match[2]};
  });
  const indexed=new Set(entries.map(entry=>entry.path));
  const working=new Set([...indexed,...names(['ls-files','--others','--exclude-standard','-z'])]);
  const hits:ScanHit[]=[];
  // Blob IDs preserve staged evidence independently of working edits, deletions and path syntax.
  for(const entry of entries)for(const line of secretLines(git(repo,['cat-file','blob',entry.object])))hits.push({path:entry.path,line,source:'index'});
  for(const path of working){
   const text=workingText(repo,path,indexed.has(path));
   // A deleted tracked working file has no working bytes; its index blob was still scanned.
   if(text!==undefined)for(const line of secretLines(text))hits.push({path,line,source:'working'});
  }
  return hits;
 }catch{throw new Error('scan_incomplete');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const root=process.argv[2];if(!root)throw new Error('usage: scan-tracked <repo-root> [additional-files...]');
 const hits=scanTracked(root);
 for(const file of process.argv.slice(3)){
  const absolute=resolve(file),base=parse(absolute).root;
  const text=workingText(base,relative(base,absolute).split(sep).join('/'),false);
  if(text===undefined)throw new Error('scan_incomplete');
  for(const line of secretLines(text))hits.push({path:file,line,source:'working'});
 }
 for(const h of hits)console.error(h.path+':'+h.line+' ('+h.source+')');
 process.exitCode=hits.length?1:0;
 }catch{console.error('scan_incomplete');process.exitCode=2;}
}
