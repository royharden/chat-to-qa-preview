// Shared adapter result types. The session (ChatSessionV1) never carries preamble, <details> regions, titles,
// file names or assistant labels; review-only material lives in ImportReview, which is in-memory only and is
// shown escaped in import review (D10 steps 6-7). Nothing here is ever serialised into a public artefact.
import type { ChatSessionV1, Role } from '../schema/chatSession.ts';
import type { RefusalCode } from './refusals.ts';

export const WARNING = {
  /** The final `<!-- xexport-cursor` line was absent (edited or truncated file). */
  MISSING_CURSOR_LINE: 'missing_cursor_line',
  /** A leading UTF-8 byte-order mark was removed. */
  BOM_REMOVED: 'bom_removed',
} as const;
export type ImportWarning = (typeof WARNING)[keyof typeof WARNING];

export const FORMAT = {
  XEXPORT_MD: 'xexport-md',
  CHAT_SESSION_JSON: 'chat-session-json',
} as const;
export type ImportFormat = (typeof FORMAT)[keyof typeof FORMAT];

export interface ImportReviewTurn {
  /** Canonical id (t1..tN), same as the session turn. */
  readonly id: string;
  readonly role: Role;
  /** 1-based line of the role heading in the LF-normalised input (Markdown only). */
  readonly headingLine: number | null;
  /** Raw text of each <details> region dropped from this turn (Markdown only). Review display only, escaped. */
  readonly droppedDetails: readonly string[];
}

export interface ImportReview {
  readonly format: ImportFormat;
  readonly profileId: string;
  /** Raw text before the first role heading (Markdown) - dropped from the session; shown escaped only. */
  readonly preamble: string;
  readonly turns: readonly ImportReviewTurn[];
  readonly warnings: readonly ImportWarning[];
}

export interface ImportAccepted {
  readonly ok: true;
  readonly session: ChatSessionV1;
  readonly review: ImportReview;
}

export interface ImportRefused {
  readonly ok: false;
  readonly refusal: RefusalCode;
  /** 1-based line in the LF-normalised Markdown input, when known. Never any content. */
  readonly line: number | null;
  /** 0-based turn index in a JSON input, when known. */
  readonly turnIndex: number | null;
}

export type ImportOutcome = ImportAccepted | ImportRefused;

export function refuse(refusal: RefusalCode, where: { line?: number; turnIndex?: number } = {}): ImportRefused {
  return { ok: false, refusal, line: where.line ?? null, turnIndex: where.turnIndex ?? null };
}
