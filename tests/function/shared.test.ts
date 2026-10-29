import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {SHARED_DIRS} from '../../scripts/sync-function-lib.ts';
describe('function source package',()=>{
 it('mirrors shared source byte-for-byte with the same relative layout',()=>{
 const root=process.cwd();
 const visit=(dir:string):void=>{for(const e of readdirSync(join(root,'src/lib',dir),{withFileTypes:true})){
 const rel=join(dir,e.name);if(e.isDirectory())visit(rel);else if(e.name.endsWith('.ts'))expect(readFileSync(join(root,'supabase/functions/propose-qa/_lib',rel))).toEqual(readFileSync(join(root,'src/lib',rel)));
 }};
 for(const dir of SHARED_DIRS)visit(dir);
 });
 it('keeps budget disabled and browser mutation denied in source migrations',()=>{
 expect(readFileSync('supabase/migrations/0002_budget.sql','utf8')).toContain("values (1,0,'disabled')");
 expect(readFileSync('supabase/migrations/0003_rls.sql','utf8')).toContain('from anon,authenticated');
 });
});
