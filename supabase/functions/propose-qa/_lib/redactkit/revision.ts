export interface RevisionTurn { readonly id: string; readonly role: 'user' | 'assistant'; readonly text: string }
export async function sourceRevision(turns: readonly RevisionTurn[], rules_version: string): Promise<string> {
  const canonical = JSON.stringify({ rules_version, turns: turns.map(({ id, role, text }) => ({ id, role, text })) });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
