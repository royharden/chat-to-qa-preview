import type { ImportAccepted } from '../adapters/types.ts';
import type { RedactedSession } from '../redactkit/index.ts';
import type { QaCandidate } from '../select/types.ts';
import type { ApprovalRow } from '../rulings/store.ts';
export interface PreviewState {
  readonly epoch: number; readonly imported: ImportAccepted | null; readonly excluded: ReadonlySet<string>;
  readonly importConfirmed: boolean; readonly denyConfirmed: boolean; readonly denyList: readonly string[];
  readonly redacted: RedactedSession | null; readonly candidate: QaCandidate | null; readonly approval: ApprovalRow | null;
}
export function initialState(): PreviewState {
  return { epoch: 0, imported: null, excluded: new Set(), importConfirmed: false, denyConfirmed: false, denyList: [], redacted: null, candidate: null, approval: null };
}
export function importedState(old: PreviewState, imported: ImportAccepted): PreviewState { return { ...initialState(), epoch: old.epoch + 1, imported }; }
export function excludeTurn(state: PreviewState, id: string): PreviewState {
  const excluded = new Set(state.excluded); if (excluded.has(id)) excluded.delete(id); else excluded.add(id);
  return { ...state, epoch: state.epoch + 1, excluded, importConfirmed: false, denyConfirmed: false, redacted: null, candidate: null, approval: null };
}
export function confirmImport(state: PreviewState): PreviewState {
  if (!state.imported) throw new Error('import_required');
  return { ...state, epoch: state.epoch + 1, importConfirmed: true, redacted: null, candidate: null, approval: null };
}
export function changeDenyList(state: PreviewState, values: readonly string[], confirmed = false): PreviewState {
  return { ...state, epoch: state.epoch + 1, denyList: [...values], denyConfirmed: confirmed && state.importConfirmed, redacted: null, candidate: null, approval: null };
}
export function canProceed(state: PreviewState): boolean { return !!state.imported && state.importConfirmed && state.denyConfirmed; }
export function acceptRedaction(state: PreviewState, epoch: number, redacted: RedactedSession, candidate: QaCandidate | null): PreviewState {
  if (state.epoch !== epoch || !canProceed(state)) return state;
  return { ...state, epoch: state.epoch + 1, redacted, candidate, approval: null };
}
export function editCandidate(state: PreviewState, candidate: QaCandidate): PreviewState {
  return { ...state, epoch: state.epoch + 1, candidate, approval: null };
}
