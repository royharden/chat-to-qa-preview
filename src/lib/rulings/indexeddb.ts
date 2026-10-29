import type { ApprovalRow, RulingsStore } from './store.ts';
export async function openRulings(): Promise<RulingsStore> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('s47-rulings-v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('rulings', { autoIncrement: true }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('storage_unavailable'));
    request.onblocked = () => reject(new Error('storage_blocked'));
  });
  return {
    durable: true,
    append(row: ApprovalRow) { return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('rulings', 'readwrite');
      tx.objectStore('rulings').add({ ...row });
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('storage_write_failed'));
    }); },
    list() { return new Promise<readonly ApprovalRow[]>((resolve, reject) => {
      const tx = db.transaction('rulings', 'readonly');
      const request = tx.objectStore('rulings').getAll();
      request.onsuccess = () => resolve(request.result as ApprovalRow[]);
      request.onerror = () => reject(new Error('storage_read_failed'));
    }); },
  };
}
