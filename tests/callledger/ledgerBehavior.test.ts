import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cliLedger} from '../../scripts/cli-ledger.ts';
import type {LedgerRow} from '../../src/lib/callledger/ledger.ts';
function row(amount:number):LedgerRow{return {id:crypto.randomUUID(),run_id:'synthetic-test',request_id:crypto.randomUUID(),operator_id:crypto.randomUUID(),provider:'anthropic',model:'synthetic-model',prompt_sha256:'0'.repeat(64),input_turn_ids:['t1','t2'],input_units:30,reserved_usd:amount,settled_usd:null,usage_json:null,latency_ms:0,status:'reserved',created_at:new Date(0).toISOString()};}
async function isolated(action:(repo:string,file:string)=>Promise<void>):Promise<void>{
 const temp=await mkdtemp(join(tmpdir(),'s47-ledger-behavior-')),repo=join(temp,'repo'),file=join(temp,'private','usage.ledger.jsonl');
 try{await mkdir(repo);execFileSync('git',['init','--quiet',repo],{stdio:'pipe'});await action(repo,file);}
 finally{await rm(temp,{recursive:true,force:true});}
}
describe('behavioral cumulative CLI ledger',()=>{
 it('persists real LF JSONL and refuses duplicate request ids across reopened instances',async()=>isolated(async(repo,file)=>{
 const first=await cliLedger(file,1,repo),reserved=row(0.4);await first.reserve(reserved);
 const text=await readFile(file,'utf8');expect(text.endsWith('\n')).toBe(true);expect(text.split('\n').filter(Boolean)).toHaveLength(1);
 expect(JSON.parse(text.trim()).request_id).toBe(reserved.request_id);
 const second=await cliLedger(file,1,repo);await expect(second.reserve(reserved)).rejects.toThrow('duplicate_request_id');
 expect((await readFile(file,'utf8')).split('\n').filter(Boolean)).toHaveLength(1);
 }));
 it('counts open and settled charges across invocations, including unknown-usage timeout',async()=>isolated(async(repo,file)=>{
 const first=await cliLedger(file,1,repo),a=row(0.7);await first.reserve(a);
 await first.settle(a.request_id,'timeout',0.7,null,30000);
 const reopened=await cliLedger(file,1,repo);
 await expect(reopened.reserve(row(0.4))).rejects.toThrow('budget_exceeded');
 const b=row(0.2);await reopened.reserve(b);await reopened.settle(b.request_id,'settled',0.1,{input_tokens:1,output_tokens:1},1);
 const again=await cliLedger(file,1,repo);await again.reserve(row(0.1));
 await expect(again.reserve(row(0.2))).rejects.toThrow('budget_exceeded');
 }));
 it('allows one concurrent reservation and prevents the other from overcommitting the cap',async()=>isolated(async(repo,file)=>{
 const a=await cliLedger(file,1,repo),b=await cliLedger(file,1,repo),one=row(0.7),two=row(0.7);
 const settled=await Promise.allSettled([a.reserve(one),b.reserve(two)]);
 expect(settled.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(settled.filter(r=>r.status==='rejected')).toHaveLength(1);
 const rows=(await readFile(file,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line) as LedgerRow);
 expect(rows).toHaveLength(1);expect(rows[0]!.reserved_usd).toBe(0.7);
 }));
 it('fails closed on a preexisting exclusive lock and does not replace it',async()=>isolated(async(repo,file)=>{
 const ledger=await cliLedger(file,1,repo);await writeFile(file+'.lock','synthetic lock',{flag:'wx'});
 await expect(ledger.reserve(row(0.1))).rejects.toMatchObject({code:'EEXIST'});
 expect(await readFile(file+'.lock','utf8')).toBe('synthetic lock');
 }));
 it('rejects malformed preexisting logs rather than resetting cumulative history',async()=>isolated(async(repo,file)=>{
 const ledger=await cliLedger(file,1,repo);await writeFile(file,'incomplete record');
 await expect(ledger.reserve(row(0.1))).rejects.toThrow();
 expect(await readFile(file,'utf8')).toBe('incomplete record');
 }));
});
