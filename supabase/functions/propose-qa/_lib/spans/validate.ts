import type { RedactedSession } from '../redactkit/brand.ts';
import type { Span } from './span.ts';
import { isUtf16Boundary, isWellFormed } from './utf16.ts';

export type SpanFailure = 'wrong_revision' | 'nonexistent_turn' | 'ineligible_turn' | 'invalid_offsets' | 'surrogate_boundary';
export type SpanValidation = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: SpanFailure };

/** Structural source interface also permits evaluator-only synthetic arms to use exactly this validator. */
export interface SpanSource {
  readonly source_revision: string;
  readonly turns: readonly { readonly id: string; readonly role: string; readonly text: string }[];
}

export function validateSpan(session: SpanSource | RedactedSession, span: Span): SpanValidation {
  if (span.source_revision !== session.source_revision) return { ok: false, reason: 'wrong_revision' };
  const matches = session.turns.filter((turn) => turn.id === span.turn_id);
  if (matches.length !== 1) return { ok: false, reason: 'nonexistent_turn' };
  const turn = matches[0]!;
  if (turn.role !== 'user' && turn.role !== 'assistant') return { ok: false, reason: 'ineligible_turn' };
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > turn.text.length) {
    return { ok: false, reason: 'invalid_offsets' };
  }
  if (!isWellFormed(turn.text) || !isUtf16Boundary(turn.text, span.start) || !isUtf16Boundary(turn.text, span.end)) {
    return { ok: false, reason: 'surrogate_boundary' };
  }
  return { ok: true, text: turn.text.slice(span.start, span.end) };
}
