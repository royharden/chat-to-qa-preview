import { serialize } from '../artifact/serialize.ts';
import type { RulingsStore, ApprovalRow } from '../rulings/store.ts';
import { canProceed } from './session.ts';
import type { PreviewState } from './session.ts';
export async function prepare(state: PreviewState) {
  if (!canProceed(state) || !state.redacted || !state.candidate) throw new Error('review_required');
  return serialize(state.redacted, state.candidate, state.imported!.review.profileId, state.denyList);
}
export async function approve(state: PreviewState, store: RulingsStore): Promise<ApprovalRow> {
  if (!store.durable) throw new Error('durable_storage_required');
  const bytes = await prepare(state);
  const row: ApprovalRow = { md_sha256: bytes.md_sha256, json_sha256: bytes.json_sha256, source_revision: state.redacted!.source_revision,
    rules_version: state.redacted!.rules_version, scan_digest: bytes.scan_digest, decision: 'approve', at: new Date().toISOString() };
  await store.append(row); return row;
}
export async function downloadBytes(state: PreviewState, format: 'md' | 'json'): Promise<Uint8Array> {
  const bytes = await prepare(state); // Every click reconstructs exact bytes and reruns gates.
  const row = state.approval;
  if (!row || row.decision !== 'approve' || row.source_revision !== state.redacted!.source_revision || row.rules_version !== state.redacted!.rules_version
    || row.md_sha256 !== bytes.md_sha256 || row.json_sha256 !== bytes.json_sha256 || row.scan_digest !== bytes.scan_digest) throw new Error('approval_missing_or_stale');
  return bytes[format];
}
