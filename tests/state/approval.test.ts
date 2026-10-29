import { describe, it, expect } from 'vitest';
import { importChatFile } from '../../src/lib/adapters/index.ts';
import { redactSession } from '../../src/lib/redactkit/index.ts';
import { selectExtractive } from '../../src/lib/select/extractive.ts';
import { initialState, importedState, confirmImport, changeDenyList, acceptRedaction, editCandidate } from '../../src/lib/state/session.ts';
import { approve, downloadBytes } from '../../src/lib/state/approval.ts';
import { memoryStore } from '../../src/lib/rulings/memory.ts';
import type { RulingsStore, ApprovalRow } from '../../src/lib/rulings/store.ts';
// what_bug_this_catches: stale async redaction, transient storage approval, and approval surviving a draft edit.
async function ready() {
  const imported = importChatFile(new TextEncoder().encode('## 👤 User\nHow should I use --strict?\n\n## 🤖 Assistant\nUse --strict for configuration.\n'));
  if (!imported.ok) throw new Error(imported.refusal);
  let state = changeDenyList(confirmImport(importedState(initialState(), imported)), [], true);
  const redacted = await redactSession(imported.session); if (!redacted.ok) throw new Error('redaction');
  const selected = selectExtractive(redacted); if (!selected.ok) throw new Error(selected.reason);
  return acceptRedaction(state, state.epoch, redacted, selected.candidate);
}
describe('approval state (unexecuted)', () => {
  it('fails closed on memory-only storage', async () => { await expect(approve(await ready(), memoryStore())).rejects.toThrow('durable_storage_required'); });
  it('binds both files and invalidates on edits or names changes', async () => {
    const state = await ready(); const rows: ApprovalRow[] = [];
    const store: RulingsStore = { durable: true, async append(row) { rows.push(row); }, async list() { return rows; } };
    const row = await approve(state, store); const approved = { ...state, approval: row };
    expect(await downloadBytes(approved, 'md')).toBeInstanceOf(Uint8Array);
    await expect(downloadBytes({ ...approved, approval: { ...row, json_sha256: 'changed' } }, 'md')).rejects.toThrow();
    const edited = editCandidate(approved, { ...state.candidate!, answer: [...state.candidate!.answer] });
    expect(edited.approval).toBeNull();
    expect(changeDenyList(approved, ['New name']).redacted).toBeNull();
    expect(acceptRedaction(edited, state.epoch, state.redacted!, state.candidate)).toBe(edited);
  });
});
