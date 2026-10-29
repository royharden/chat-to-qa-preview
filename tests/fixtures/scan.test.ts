import {afterEach,describe,it,expect} from 'vitest';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,symlinkSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanTracked,secretLines} from '../../scripts/scan-tracked.ts';
import {slotValue} from '../../src/lib/fixtures/slots.ts';
import type {SlotKind} from '../../src/lib/fixtures/slots.ts';
import {seeded} from '../../src/lib/fixtures/prng.ts';
describe('K21 tracked scan',()=>{
 it('finds runtime-built examples for each prefixed class without committed credentials',()=>{
 for(const kind of ['GH_PAT','AWS_KEY_ID','OPENAI_KEY','SLACK_TOKEN','JWT','PEM_BLOCK','BEARER'] as SlotKind[])
 expect(secretLines('header\n'+slotValue(kind,seeded(52))).length).toBeGreaterThan(0);
 });
 it('does not mistake typed slots for generated secrets',()=>{
 expect(secretLines('Bearer {{BEARER:token}}\n{{GH_PAT:token}}')).toEqual([]);
 });
});

// Deferred: these cases create synthetic repositories and materialise matches only at runtime.
// Each test owns its temporary sandbox; no product repository or real credential is an input.
const sandboxes:string[]=[];
afterEach(()=>{for(const sandbox of sandboxes.splice(0))rmSync(sandbox,{recursive:true,force:true});});
function git(root:string,...args:string[]):void{
 execFileSync('git',['-C',root,'-c','core.autocrlf=false',...args],{stdio:['ignore','pipe','pipe']});
}
function repository(){
 const sandbox=mkdtempSync(join(tmpdir(),'s47-scan-'));sandboxes.push(sandbox);
 const root=join(sandbox,'repo');mkdirSync(root);git(root,'init','--quiet');
 return {root,sandbox};
}
function runtimeMatch(letter='A'):string{return 'gh'+'p_'+letter.repeat(36);}
function cli(root:string){
 const script=fileURLToPath(new URL('../../scripts/scan-tracked.ts',import.meta.url));
 const result=spawnSync(process.execPath,['--no-warnings',script,root],{encoding:'utf8'});
 expect(result.error).toBeUndefined();expect(result.signal).toBeNull();expect(result.stdout).toBe('');
 return result;
}

describe('K21 Git surfaces and safe diagnostics (deferred)',()=>{
 it('reports a clean repository as clean',()=>{
  const {root}=repository();writeFileSync(join(root,'clean.txt'),'ordinary source\n');
  expect(scanTracked(root)).toEqual([]);
  const result=cli(root);expect(result.status).toBe(0);expect(result.stderr).toBe('');
 });
 it('finds a new untracked working file automatically and prints only its location',()=>{
  // Regression: the old cached-name-only scan returned clean for this entire repository.
  const {root}=repository();writeFileSync(join(root,'new-source.ts'),'header\n'+runtimeMatch()+'\n');
  expect(scanTracked(root)).toEqual([{path:'new-source.ts',line:2,source:'working'}]);
  const result=cli(root);expect(result.status).toBe(1);expect(result.stderr).toBe('new-source.ts:2 (working)\n');
 });
 it('scans tracked working bytes when the staged version is clean',()=>{
  const {root}=repository();writeFileSync(join(root,'source.txt'),'clean staged text\n');git(root,'add','source.txt');
  writeFileSync(join(root,'source.txt'),'header\n'+runtimeMatch()+'\n');
  expect(scanTracked(root)).toEqual([{path:'source.txt',line:2,source:'working'}]);
 });
 it('keeps divergent index and working evidence independently with their own line numbers',()=>{
  const {root}=repository();writeFileSync(join(root,'source.txt'),'header\n'+runtimeMatch('A')+'\n');git(root,'add','source.txt');
  writeFileSync(join(root,'source.txt'),'header\nclean line\n'+runtimeMatch('B')+'\n');
  expect(scanTracked(root)).toEqual([{path:'source.txt',line:2,source:'index'},{path:'source.txt',line:3,source:'working'}]);
  const result=cli(root);expect(result.status).toBe(1);
  expect(result.stderr).toBe('source.txt:2 (index)\nsource.txt:3 (working)\n');
 });
 it('still rejects staged-only evidence after its working file is deleted',()=>{
  // Regression: reading a missing working copy first used to hide its index hit behind an error.
  const {root}=repository();writeFileSync(join(root,'deleted.txt'),'header\n'+runtimeMatch()+'\n');git(root,'add','deleted.txt');
  unlinkSync(join(root,'deleted.txt'));
  expect(scanTracked(root)).toEqual([{path:'deleted.txt',line:2,source:'index'}]);
  const result=cli(root);expect(result.status).toBe(1);expect(result.stderr).toBe('deleted.txt:2 (index)\n');
 });
 it('accepts a clean indexed file whose working copy was deleted',()=>{
  const {root}=repository();writeFileSync(join(root,'deleted.txt'),'ordinary text\n');git(root,'add','deleted.txt');
  unlinkSync(join(root,'deleted.txt'));
  expect(scanTracked(root)).toEqual([]);
  const result=cli(root);expect(result.status).toBe(0);expect(result.stderr).toBe('');
 });
 it('uses Git ignores for untracked files while continuing to scan ignored tracked files',()=>{
  const {root}=repository();writeFileSync(join(root,'.gitignore'),'*.tmp\n');
  writeFileSync(join(root,'ignored.tmp'),runtimeMatch()+'\n');
  expect(scanTracked(root)).toEqual([]);
  const clean=cli(root);expect(clean.status).toBe(0);expect(clean.stderr).toBe('');
  writeFileSync(join(root,'tracked.tmp'),runtimeMatch('B')+'\n');git(root,'add','--force','tracked.tmp');
  expect(scanTracked(root)).toEqual([{path:'tracked.tmp',line:1,source:'index'},{path:'tracked.tmp',line:1,source:'working'}]);
 });
 it('resolves a subdirectory argument to the repository root',()=>{
  const {root}=repository();mkdirSync(join(root,'nested'));
  writeFileSync(join(root,'outside-subdir.txt'),runtimeMatch()+'\n');
  expect(scanTracked(join(root,'nested'))).toEqual([{path:'outside-subdir.txt',line:1,source:'working'}]);
 });
 it('fails closed for a nonregular tracked working path without printing bytes or raw errors',()=>{
  const {root}=repository();writeFileSync(join(root,'replaced.txt'),'ordinary text\n');git(root,'add','replaced.txt');
  unlinkSync(join(root,'replaced.txt'));mkdirSync(join(root,'replaced.txt'));
  expect(()=>scanTracked(root)).toThrow('scan_incomplete');
  const result=cli(root);expect(result.status).toBe(2);expect(result.stderr).toBe('scan_incomplete\n');
 });
 it('refuses a symlink replacing a tracked directory before reading its target',()=>{
  const {root,sandbox}=repository();mkdirSync(join(root,'nested'));
  writeFileSync(join(root,'nested','source.txt'),'ordinary text\n');git(root,'add','nested/source.txt');
  rmSync(join(root,'nested'),{recursive:true});const target=join(sandbox,'synthetic-target');mkdirSync(target);
  writeFileSync(join(target,'source.txt'),runtimeMatch()+'\n');
  symlinkSync(target,join(root,'nested'),process.platform==='win32'?'junction':'dir');
  expect(()=>scanTracked(root)).toThrow('scan_incomplete');
  const result=cli(root);expect(result.status).toBe(2);expect(result.stderr).toBe('scan_incomplete\n');
 });
 it('refuses an untracked symlink rather than scanning an external target',()=>{
  const {root,sandbox}=repository();const target=join(sandbox,'synthetic-target');mkdirSync(target);
  writeFileSync(join(target,'source.txt'),runtimeMatch()+'\n');
  symlinkSync(target,join(root,'new-link'),process.platform==='win32'?'junction':'dir');
  expect(()=>scanTracked(root)).toThrow('scan_incomplete');
  const result=cli(root);expect(result.status).toBe(2);expect(result.stderr).toBe('scan_incomplete\n');
 });
 it('fails closed when Git cannot read the index and suppresses Git diagnostics',()=>{
  const {root}=repository();writeFileSync(join(root,'.git','index'),'invalid synthetic index\n');
  expect(()=>scanTracked(root)).toThrow('scan_incomplete');
  const result=cli(root);expect(result.status).toBe(2);expect(result.stderr).toBe('scan_incomplete\n');
 });
});
