import {describe,it,expect} from 'vitest';
import {manifestHash,manifestText,sha256} from '../../src/lib/fixtures/manifestHash.ts';
describe('N13 manifest digest',()=>{
 it('sorts paths and normalises LF before hashing exact manifest lines',async()=>{
 const a={path:'a.tmpl',bytes:'alpha\r\n'},b={path:'b.tmpl',bytes:'beta\n'};
 const text=(await sha256('alpha\n'))+'  a.tmpl\n'+(await sha256('beta\n'))+'  b.tmpl\n';
 expect(await manifestText([b,a])).toBe(text);
 expect(await manifestHash([a,b])).toBe(await sha256(text));
 expect(await manifestHash([b,{...a,bytes:'alpha\n'}])).toBe(await manifestHash([a,b]));
 });
 it('binds paths as well as bytes and refuses duplicate/traversal paths',async()=>{
 expect(await manifestHash([{path:'a',bytes:'x'}])).not.toBe(await manifestHash([{path:'b',bytes:'x'}]));
 await expect(manifestHash([{path:'../a',bytes:'x'}])).rejects.toThrow('invalid_manifest_path');
 await expect(manifestHash([{path:'a',bytes:'x'},{path:'a',bytes:'y'}])).rejects.toThrow('invalid_manifest_path');
 });
});
