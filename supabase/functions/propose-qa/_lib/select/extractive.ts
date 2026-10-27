import type { RedactedSession } from '../redactkit/brand.ts';
import { isRedactedSession } from '../redactkit/index.ts';
import { extractiveCore, rankPairsCore } from './core.ts';
import type { ScoredPair, SelectionResult } from './types.ts';

/** Only authenticated in-memory redaction sessions enter the product selector. */
export function rankPairs(session: RedactedSession): readonly ScoredPair[] {
  return isRedactedSession(session) ? rankPairsCore(session) : [];
}

export function selectExtractive(session: RedactedSession): SelectionResult {
  return isRedactedSession(session) ? extractiveCore(session) : { ok: false, reason: 'no_qualifying_pair' };
}
