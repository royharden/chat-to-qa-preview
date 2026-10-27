import { afterEach, expect, it, vi } from 'vitest';
import { openRulings } from '../../src/lib/rulings/indexeddb.ts';
afterEach(()=>vi.unstubAllGlobals());
// what_bug_this_catches: treating an IndexedDB request/transaction denial as a successful durable approval.
it('rejects database-open and transaction-write denial',async()=>{
  vi.stubGlobal('indexedDB',{open:()=>{const req:{onerror?:()=>void}={};queueMicrotask(()=>req.onerror?.());return req;}});
  await expect(openRulings()).rejects.toThrow('storage_unavailable');
  vi.stubGlobal('indexedDB',{open:()=>{const req:{onsuccess?:()=>void;result:unknown}={result:{transaction:()=>{
    const tx:{onerror?:()=>void;objectStore:()=>{add:()=>void}}={objectStore:()=>({add:()=>{queueMicrotask(()=>tx.onerror?.());}})};return tx;
  }}};queueMicrotask(()=>req.onsuccess?.());return req;}});
  const store=await openRulings();
  await expect(store.append({md_sha256:'a',json_sha256:'b',source_revision:'c',rules_version:'d',scan_digest:'e',decision:'approve',at:'f'})).rejects.toThrow('storage_write_failed');
});
