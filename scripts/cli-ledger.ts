import {open,readFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import type {Ledger,LedgerRow} from '../src/lib/callledger/ledger.ts';
import {totalCommitted} from '../src/lib/callledger/ledger.ts';
import {capUsd} from '../src/lib/callledger/reserve.ts';
type PathContainment={relative(from:string,to:string):string;isAbsolute(path:string):boolean;sep:string};
/** A filename beginning with two dots is still inside; only a parent segment escapes. */
export function isOutsideRepo(root:string,target:string,paths:PathContainment={relative,isAbsolute,sep}):boolean{
 const rel=paths.relative(root,target);
 return paths.isAbsolute(rel)||rel==='..'||rel.startsWith('..'+paths.sep);
}
/** Append-only event log. Exclusive lock covers each read/check/append mutation; never breaks a stale lock. */
export async function cliLedger(file:string,capValue:unknown,repoRoot:string):Promise<Ledger>{
 const cap=capUsd(capValue),target=resolve(file);
 const top=resolve(execFileSync('git',['-C',repoRoot,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim());
 if(!isOutsideRepo(top,target))throw new Error('ledger_must_be_outside_repo');
 await mkdir(dirname(target),{recursive:true});
 const actualParent=await realpath(dirname(target)),canonical=resolve(actualParent,(await import('node:path')).basename(target));
 if(!isOutsideRepo(top,canonical))throw new Error('ledger_must_be_outside_repo');
 try{if((await lstat(target)).isSymbolicLink())throw new Error('ledger_symlink_refused');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 async function mutate(action:(rows:LedgerRow[])=>LedgerRow):Promise<void>{
 const lock=await open(target+'.lock','wx');
 try{
 let text='';try{text=await readFile(target,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(text&&!text.endsWith('\n'))throw new Error('incomplete_ledger_tail');
 const latest=new Map<string,LedgerRow>();
 for(const line of text.split('\n').filter(Boolean)){
 const row=JSON.parse(line) as LedgerRow;
 if(!row.request_id||!Number.isFinite(row.reserved_usd)||row.reserved_usd<0||!['reserved','settled','failed','timeout'].includes(row.status))throw new Error('invalid_ledger');
 if(row.status!=='reserved'&&(!Number.isFinite(row.settled_usd)||row.settled_usd!<0))throw new Error('invalid_ledger');
 latest.set(row.request_id,row);
 }
 const next=action([...latest.values()]);
 const output=await open(target,'a',0o600);try{await output.writeFile(JSON.stringify(next)+'\n');await output.sync();}finally{await output.close();}
 }finally{await lock.close();const fs=await import('node:fs/promises');await fs.unlink(target+'.lock');}
 }
 return {
 reserve:row=>mutate(rows=>{
 if(rows.some(r=>r.request_id===row.request_id))throw new Error('duplicate_request_id');
 if(!Number.isFinite(row.reserved_usd)||row.reserved_usd<0||row.status!=='reserved'||totalCommitted(rows)+row.reserved_usd>cap)throw new Error('budget_exceeded');
 return row;
 }),
 settle:(id,status,usd,usage,latency)=>mutate(rows=>{
 const row=rows.find(r=>r.request_id===id);if(!row||row.status!=='reserved')throw new Error('unknown_or_settled_request');
 if(!Number.isFinite(usd)||usd<0||usd>row.reserved_usd)throw new Error('settlement_out_of_bounds');
 return {...row,status,settled_usd:usage===null?row.reserved_usd:usd,usage_json:usage,latency_ms:latency};
 }),
 };
}
export const PROVIDER_NOTICE='Live mode sends only bounded redacted user/assistant turns to the selected provider. This local cumulative cap is not server-enforced. Provider may retain submitted text. --confirm-provider-send is required.';
