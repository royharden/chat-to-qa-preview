import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {heldoutRunProvenance} from '../../scripts/eval.ts';
// what_bug_this_catches: post-reveal reruns had no explicit diagnostic label or binding to preserved first-run metadata.
describe('held-out output provenance (unexecuted)',()=>{
 it('requires an explicit first-run or diagnostic choice',async()=>{
  await expect(heldoutRunProvenance(false,undefined,'synthetic-test-fingerprint')).rejects.toThrow('heldout_run_kind_required');
  await expect(heldoutRunProvenance(true,'unused','synthetic-test-fingerprint')).rejects.toThrow('heldout_run_kind_required');
  expect(await heldoutRunProvenance(true,undefined,'synthetic-test-fingerprint')).toEqual({run_kind:'heldout_first_run'});
 });
 it('labels a diagnostic of the same admitted set and preserves the first metadata bytes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'s47-output-provenance-')),file=join(dir,'run.json');
  // Runtime-only test metadata; no admission receipt, oracle labels or hidden corpus is authored.
  const first=JSON.stringify({run_kind:'heldout_first_run',admission_fingerprint:'synthetic-test-fingerprint'});
  try{
   await writeFile(file,first);
   const diagnostic=await heldoutRunProvenance(false,dir,'synthetic-test-fingerprint');
   expect(diagnostic.run_kind).toBe('known_set_diagnostic');expect(diagnostic.first_run_reference).toMatch(/^sha256:[a-f0-9]{64}$/);
   expect(await readFile(file,'utf8')).toBe(first);
   await expect(heldoutRunProvenance(false,dir,'different-synthetic-fingerprint')).rejects.toThrow('first_run_reference_mismatch');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
