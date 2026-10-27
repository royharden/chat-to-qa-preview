import {describe,it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cliLedger} from '../../scripts/cli-ledger.ts';
import type {LedgerRow} from '../../src/lib/callledger/ledger.ts';
describe('CLI cumulative durable cap',()=>{
 it('serializes competing reservations and retains timeout charge across invocations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'s47-ledger-')),file=join(dir,'ledger.jsonl');
 try{
 const ledger=await cliLedger(file,1,process.cwd());
 const row={id:crypto.randomUUID(),run_id:'test',request_id:crypto.randomUUID(),operator_id:crypto.randomUUID(),provider:'anthropic',model:'test',prompt_sha256:'0'.repeat(64),input_turn_ids:['t1'],input_units:1,reserved_usd:0.7,settled_usd:null,usage_json:null,latency_ms:0,status:'reserved',created_at:'2026-10-27'} as LedgerRow;
 await ledger.reserve(row);await expect(ledger.reserve(row)).rejects.toThrow('duplicate_request_id');
 await ledger.settle(row.request_id,'timeout',0.7,null,10);
 const again=await cliLedger(file,1,process.cwd());await expect(again.reserve({...row,request_id:crypto.randomUUID(),reserved_usd:0.4})).rejects.toThrow('budget_exceeded');
 }finally{await rm(dir,{recursive:true,force:true});}
 });
});
