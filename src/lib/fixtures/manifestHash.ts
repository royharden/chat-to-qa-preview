export type ManifestEntry={path:string;bytes:Uint8Array|string};
export async function sha256(bytes:Uint8Array|string):Promise<string>{
 const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function normaliseLf(bytes:Uint8Array|string):string{return (typeof bytes==='string'?bytes:new TextDecoder('utf-8',{fatal:true}).decode(bytes)).replace(/\r\n?/g,'\n');}
function compare(a:string,b:string):number{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]!-y[i]!;return x.length-y.length;}
export async function manifestText(entries:readonly ManifestEntry[]):Promise<string>{
 const seen=new Set<string>();const rows=entries.map(e=>{const path=e.path.replace(/\\/g,'/');
 if(!path||path.startsWith('/')||/^[A-Za-z]:/.test(path)||path.split('/').some(p=>p==='..'||p==='.'||!p)||/[\r\n]/.test(path)||seen.has(path))throw new Error('invalid_manifest_path');
 seen.add(path);return {...e,path};}).sort((a,b)=>compare(a.path,b.path));
 if(!rows.length)throw new Error('empty_manifest');
 return (await Promise.all(rows.map(async e=>(await sha256(normaliseLf(e.bytes)))+'  '+e.path+'\n'))).join('');
}
export async function manifestHash(entries:readonly ManifestEntry[]):Promise<string>{return sha256(await manifestText(entries));}
export async function manifestHashFromDirectory(directory:string):Promise<string>{
 const fs=await import('node:fs/promises'),path=await import('node:path'),entries:ManifestEntry[]=[];
 async function walk(dir:string,prefix:string):Promise<void>{for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('symlink_refused');const rel=prefix+e.name,absolute=path.join(dir,e.name);if(e.isDirectory())await walk(absolute,rel+'/');else if(e.isFile())entries.push({path:rel,bytes:await fs.readFile(absolute)});else throw new Error('special_file_refused');}}
 if((await fs.lstat(directory)).isSymbolicLink())throw new Error('symlink_refused');
 await walk(directory,'');return manifestHash(entries);
}
