import {afterEach,describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {freezeSource} from '../../scripts/freeze.ts';

// Deferred only: all Git commits and byte materialisation below belong to disposable synthetic repositories.
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
function git(root:string,...args:string[]):void{
  execFileSync('git',['-C',root,'-c','core.autocrlf=false','-c','commit.gpgsign=false',
    '-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid',...args],{stdio:'pipe'});
}
async function put(root:string,path:string,bytes:Uint8Array|string):Promise<void>{
  const file=join(root,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
}
async function repository(){
  const root=await mkdtemp(join(tmpdir(),'s47-freeze-'));roots.push(root);git(root,'init','--quiet');
  const baseline='export const unchanged = true;\n';
  await put(root,'.gitattributes','* text=auto eol=lf\nfixtures/refusals/** -text\n');
  await put(root,'src/lib/baselines/base.ts',baseline);
  await put(root,'src/lib/baselines/FREEZE.json',JSON.stringify({files:{'src/lib/baselines/base.ts':digest(baseline)}})+'\n');
  await put(root,'src/app.ts','export const source = true;\n');
  await put(root,'scripts/example.ts','export const script = true;\n');
  await put(root,'supabase/example.sql','select 1;\n');
  await put(root,'tests/example.test.ts','// synthetic test source\n');
  await put(root,'fixtures/dev/MANIFEST.json','{\n  "fixture": true\n}\n');
  await put(root,'fixtures/dev/dev-01.md.tmpl','alpha\nbeta\n');
  await put(root,'fixtures/dev/dev-01.labels.json','{\n  "fixture": true\n}\n');
  await put(root,'fixtures/refusals/bad_encoding_or_control_chars.md',new Uint8Array([0xff]));
  await put(root,'evaluation/prereg.json','{}\n');
  git(root,'add','--all');git(root,'commit','--quiet','-m','synthetic freeze source');return root;
}

describe('source snapshot byte policy (deferred)',()=>{
  // what_bug_this_catches: the intentional invalid-UTF8 refusal fixture made every full source freeze decode and refuse.
  it('binds intentional byte-exact fixture bytes and every source tree without decoding binary payloads',async()=>{
    const root=await repository(),snapshot=await freezeSource(root),binaryPath='fixtures/refusals/bad_encoding_or_control_chars.md';
    const raw=digest(new Uint8Array([0xff]));
    expect(snapshot.source_snapshot_algorithm).toBe('s47.source-snapshot.v1');
    expect(snapshot.source_snapshot_files.find(file=>file.path===binaryPath)).toEqual({path:binaryPath,encoding:'raw-bytes',raw_sha256:raw,sha256:raw});
    expect(snapshot.source_files.find(file=>file.path===binaryPath)).toEqual({path:binaryPath,sha256:raw});
    for(const path of ['src/app.ts','scripts/example.ts','supabase/example.sql','tests/example.test.ts'])
      expect(snapshot.source_files.some(file=>file.path===path)).toBe(true);
    const rows=snapshot.source_snapshot_files.map(file=>JSON.stringify([file.path,file.encoding,file.raw_sha256,file.sha256])+'\n').join('');
    expect(snapshot.source_manifest_sha256).toBe(digest('s47.source-snapshot.v1\n'+rows));
    await put(root,binaryPath,new Uint8Array([0xff,0x00]));git(root,'add','--all');git(root,'commit','--quiet','-m','change synthetic binary');
    const changed=await freezeSource(root);
    expect(changed.source_manifest_sha256).not.toBe(snapshot.source_manifest_sha256);
    expect(changed.source_snapshot_files.find(file=>file.path===binaryPath)?.raw_sha256).toBe(digest(new Uint8Array([0xff,0x00])));
  });
  it('keeps live dev manifest, recipe and label digests equal for valid LF and CRLF text while binding raw bytes',async()=>{
    const root=await repository(),lf=await freezeSource(root);
    const paths=['fixtures/dev/MANIFEST.json','fixtures/dev/dev-01.md.tmpl','fixtures/dev/dev-01.labels.json'];
    for(const path of paths){const text=await readFile(join(root,path),'utf8');await put(root,path,text.replace(/\n/g,'\r\n'));}
    // Git's text conversion leaves the canonical index unchanged and the worktree clean; working raw bytes differ.
    git(root,'add','fixtures/dev');const crlf=await freezeSource(root);
    for(const path of paths){
      const before=lf.source_snapshot_files.find(file=>file.path===path),after=crlf.source_snapshot_files.find(file=>file.path===path);
      expect(before?.encoding).toBe('utf8-lf');expect(after?.encoding).toBe('utf8-lf');
      expect(after?.sha256).toBe(before?.sha256);expect(after?.raw_sha256).not.toBe(before?.raw_sha256);
      expect(crlf.source_files.find(file=>file.path===path)?.sha256).toBe(lf.source_files.find(file=>file.path===path)?.sha256);
    }
    expect(crlf.source_manifest_sha256).not.toBe(lf.source_manifest_sha256);
  });
  it('keeps invalid UTF-8 in application text a refusal rather than guessing a binary fallback',async()=>{
    const root=await repository();await put(root,'src/app.ts',new Uint8Array([0xff]));
    git(root,'add','src/app.ts');git(root,'commit','--quiet','-m','invalid synthetic application text');
    await expect(freezeSource(root)).rejects.toThrow('source_text_not_utf8');
  });
  it('sorts manifest paths by UTF-8 bytes, including names whose UTF-16 order differs',async()=>{
    const root=await repository(),first='fixtures/\uE000.txt',second='fixtures/\u{10000}.txt';
    await put(root,first,'first\n');await put(root,second,'second\n');git(root,'add','fixtures');git(root,'commit','--quiet','-m','synthetic path ordering');
    const paths=(await freezeSource(root)).source_snapshot_files.map(file=>file.path);
    expect(paths.indexOf(first)).toBeGreaterThanOrEqual(0);expect(paths.indexOf(second)).toBeGreaterThan(paths.indexOf(first));
  });
});
