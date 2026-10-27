// The only two views from which candidates, model input and excerpts are built (PLAN-FINAL M1, K3).
// Both return user/assistant turns that were not excluded in import review, in document order. Tool and thinking
// turns never appear. Preamble and <details> regions are not part of any session turn (adapters keep them only in
// ImportReview), so they are absent here by construction. Generic over the turn type so the same filter later
// applies to redacted sessions.
import type { Role } from '../schema/chatSession.ts';

export type CandidateRole = 'user' | 'assistant';

export interface TurnLike {
  readonly id: string;
  readonly role: Role;
  readonly text: string;
}

export interface SessionLike<T extends TurnLike> {
  readonly turns: readonly T[];
}

export type CandidateTurn<T extends TurnLike> = T & { readonly role: CandidateRole };

function isCandidateRole<T extends TurnLike>(turn: T): turn is CandidateTurn<T> {
  return turn.role === 'user' || turn.role === 'assistant';
}

function eligible<T extends TurnLike>(session: SessionLike<T>, excludedTurnIds: ReadonlySet<string>): readonly CandidateTurn<T>[] {
  const out: CandidateTurn<T>[] = [];
  for (const turn of session.turns) {
    if (isCandidateRole(turn) && !excludedTurnIds.has(turn.id)) out.push(turn);
  }
  return Object.freeze(out);
}

/** Turns the extractive selector and excerpt builder may read. `excludedTurnIds` comes from import review. */
export function candidateTurns<T extends TurnLike>(
  session: SessionLike<T>,
  excludedTurnIds: ReadonlySet<string>,
): readonly CandidateTurn<T>[] {
  return eligible(session, excludedTurnIds);
}

/** Turns from which model input may be built (bounded later by buildModelInput, K5). Same eligibility rule. */
export function modelViewTurns<T extends TurnLike>(
  session: SessionLike<T>,
  excludedTurnIds: ReadonlySet<string>,
): readonly CandidateTurn<T>[] {
  return eligible(session, excludedTurnIds);
}
