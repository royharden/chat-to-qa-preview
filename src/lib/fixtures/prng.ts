export type Random = () => number;
/** Deterministic Mulberry32, never cryptography. */
export function seeded(seed: number): Random {
 if(!Number.isSafeInteger(seed)) throw new Error('invalid_seed');
 let state=seed>>>0;
 return ()=>{ state=(state+0x6d2b79f5)>>>0; let t=Math.imul(state^(state>>>15),1|state);
 t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function chars(r: Random,n: number,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
 return Array.from({length:n},()=>alphabet[Math.floor(r()*alphabet.length)]!).join('');
}
