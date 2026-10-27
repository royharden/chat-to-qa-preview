import type { Span } from '../spans/span.ts';

export interface QaBlock {
  readonly kind: 'sentence' | 'code';
  readonly text: string;
  readonly spans: readonly Span[];
}

export interface QaCandidate {
  readonly question: QaBlock;
  readonly answer: readonly QaBlock[];
  readonly source_revision: string;
}

export interface ScoredPair {
  readonly user_turn_id: string;
  readonly assistant_turn_id: string;
  /** Indices in candidateTurns(session, new Set()), also the redacted session's eligible view. */
  readonly user_index: number;
  readonly assistant_index: number;
  readonly question_score: number;
  readonly score: number;
}

export type SelectionFailure = 'no_qualifying_pair' | 'question_limit' | 'answer_limit' | 'invalid_blocks';
export type SelectionResult = { readonly ok: true; readonly candidate: QaCandidate; readonly pair: ScoredPair } |
  { readonly ok: false; readonly reason: SelectionFailure };

export const QA_LIMITS = Object.freeze({ question: 500, answer: 6000, blocks: 20, spansPerBlock: 3, extractiveBlocks: 6 });
