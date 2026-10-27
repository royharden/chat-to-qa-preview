import { describe, expect, it } from 'vitest';
import type { QaCandidate } from '../../src/lib/select/types.ts';
import { MUTATORS } from '../../src/lib/mutators/index.ts';
import { checkCandidate } from '../../src/lib/spanground/check.ts';

const GOLD: Readonly<Record<string, string>> = {
  number_change: 'Set the count to 42.', version_change: 'Use v5.4.2.', flag_rename: 'Use --max-old-space-size.',
  identifier_swap: 'Change vite.config.ts.', nonexistent_turn: 'Use build7.', wrong_revision: 'Use build7.',
  over_broad_span: 'Use build7.', dropped_negation: 'Do not use the cache.', relation_swap: 'The client calls the server.', paraphrase: 'Use the cache.',
};

describe('fresh grounding mutation inventory', () => {
  it.each(MUTATORS)('$id changes a gold candidate and has the declared lexical outcome', (mutator) => {
    const gold = GOLD[mutator.id]!;
    const question = 'How?';
    const source = { source_revision: 'rev', turns: [{ id: 't1', role: 'user', text: question }, { id: 't2', role: 'assistant', text: `${gold} Run again.` }] };
    const candidate: QaCandidate = {
      source_revision: 'rev',
      question: { kind: 'sentence', text: question, spans: [{ turn_id: 't1', start: 0, end: question.length, source_revision: 'rev' }] },
      answer: [{ kind: 'sentence', text: gold, spans: [{ turn_id: 't2', start: 0, end: gold.length, source_revision: 'rev' }] }],
    };
    expect(checkCandidate(source, candidate).ok).toBe(true);
    const changed = mutator.mutate(candidate, source);
    expect(changed).not.toBeNull();
    expect(changed).not.toEqual(candidate);
    if (!changed) return;
    expect(checkCandidate(source, changed).ok).toBe(!mutator.expectedCaught);
    // Negation, relation swap and paraphrase intentionally remain expected NOT caught.
    expect(candidate.answer[0]?.text).toBe(gold);
  });
  it('returns null when a text mutation has no matching gold token', () => {
    const candidate: QaCandidate = { source_revision: 'rev', question: { kind: 'sentence', text: 'How?', spans: [] }, answer: [{ kind: 'sentence', text: 'Use the cache.', spans: [] }] };
    expect(MUTATORS.find((mutator) => mutator.id === 'version_change')!.mutate(candidate)).toBeNull();
  });
});
