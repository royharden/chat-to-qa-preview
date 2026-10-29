import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
/** Copies the declared shared module closure, preserving exact source bytes and relative layout. */
export const SHARED_DIRS=['providers','callledger','select','redactkit','session','schema','spanground','spans'] as const;
export async function syncFunctionLib(repoRoot:string):Promise<void>{
 const src=resolve(repoRoot,'src/lib'),dst=resolve(repoRoot,'supabase/functions/propose-qa/_lib');
 async function copy(dir:string):Promise<void>{for(const e of await readdir(dir,{withFileTypes:true})){
 if(e.isSymbolicLink())throw new Error('symlink_refused');const file=resolve(dir,e.name);
 if(e.isDirectory())await copy(file);else if(e.isFile()&&e.name.endsWith('.ts')){const target=resolve(dst,relative(src,file));await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(file));}
 }}
 for(const name of SHARED_DIRS)await copy(resolve(src,name));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=process.argv[2];if(!root)throw new Error('explicit_repo_root_required');await syncFunctionLib(root);
}
