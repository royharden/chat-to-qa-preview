import {describe,it,expect} from 'vitest';
import {posix,win32} from 'node:path';
import {isOutsideRepo} from '../../scripts/cli-ledger.ts';

// what_bug_this_catches: '..ledger.jsonl' passed both lexical and canonical outside-repo guards.
describe('ledger path containment (unexecuted)',()=>{
 for(const [label,paths,root]of [['POSIX',posix,'/workspace/product'],['Windows',win32,'C:\\workspace\\product']] as const){
  it(label+' treats dot-prefixed names as repository descendants',()=>{
   for(const name of ['..ledger.jsonl','...ledger.jsonl','nested/..ledger.jsonl','ledger.jsonl','.']){
    expect(isOutsideRepo(root,paths.resolve(root,name),paths)).toBe(false);
   }
  });
  it(label+' permits actual parent segments and outside siblings',()=>{
   for(const name of ['..','../ledger.jsonl','../product-other/ledger.jsonl']){
    expect(isOutsideRepo(root,paths.resolve(root,name),paths)).toBe(true);
   }
  });
 }
 it('recognizes a different Windows drive as outside',()=>{
  expect(isOutsideRepo('C:\\workspace\\product','D:\\ledger.jsonl',win32)).toBe(true);
 });
 it('rejects a canonical target inside the repository even when its lexical location is outside',()=>{
  const root='/workspace/product';
  expect(isOutsideRepo(root,'/workspace/external-link/..ledger.jsonl',posix)).toBe(true);
  // A mocked realpath result: the link resolves to an in-repository directory.
  const actualParent='/workspace/product/ledgers';
  expect(isOutsideRepo(root,posix.resolve(actualParent,'..ledger.jsonl'),posix)).toBe(false);
 });
});
