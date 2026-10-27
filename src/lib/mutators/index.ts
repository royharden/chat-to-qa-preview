import type { QaBlock, QaCandidate } from '../select/types.ts';
import type { SpanSource } from '../spans/validate.ts';

export type MutatorId = 'number_change' | 'version_change' | 'flag_rename' | 'identifier_swap' | 'nonexistent_turn' | 'wrong_revision' | 'over_broad_span' | 'dropped_negation' | 'relation_swap' | 'paraphrase';
export interface Mutator {
  readonly id: MutatorId;
  readonly expectedCaught: boolean;
  /** Null means the declared mutation does not apply; never report an unchanged candidate as mutated. */
  readonly mutate: (candidate: QaCandidate, source?: SpanSource) => QaCandidate | null;
}

function replaceAnswer(candidate: QaCandidate, transform: (block: QaBlock) => QaBlock | null): QaCandidate | null {
  for (let i = 0; i < candidate.answer.length; i += 1) {
    const before = candidate.answer[i]!;
    const after = transform(before);
    if (after && JSON.stringify(after) !== JSON.stringify(before)) {
      return { ...candidate, answer: candidate.answer.map((block, index) => index === i ? after : block) };
    }
  }
  return null;
}

function textMutation(id: MutatorId, pattern: RegExp, replacement: string | ((match: string) => string), expectedCaught = true): Mutator {
  return { id, expectedCaught, mutate: (candidate) => replaceAnswer(candidate, (block) => {
    if (block.kind !== 'sentence') return null;
    const text = typeof replacement === 'string' ? block.text.replace(pattern, replacement) : block.text.replace(pattern, replacement);
    return text === block.text ? null : { ...block, text };
  }) };
}

export const MUTATORS: readonly Mutator[] = Object.freeze([
  textMutation('number_change', /\b[0-9]+\b/u, (value) => String(Number(value) + 1)),
  textMutation('version_change', /\bv[0-9]+\.[0-9]+\.[0-9]+\b/u, (value) => value.replace(/[0-9]+$/u, (patch) => String(Number(patch) + 1))),
  textMutation('flag_rename', /--[A-Za-z][A-Za-z0-9-]*/u, (value) => `${value}-changed`),
  textMutation('identifier_swap', /\b[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9]*\b/u, 'replacement.config'),
  { id: 'nonexistent_turn', expectedCaught: true, mutate: (candidate) => replaceAnswer(candidate, (block) => {
    if (!block.spans[0]) return null;
    return { ...block, spans: block.spans.map((span, index) => index === 0 ? { ...span, turn_id: 't999999' } : span) };
  }) },
  { id: 'wrong_revision', expectedCaught: true, mutate: (candidate) => replaceAnswer(candidate, (block) => {
    if (!block.spans[0]) return null;
    return { ...block, spans: block.spans.map((span, index) => index === 0 ? { ...span, source_revision: `${span.source_revision}-stale` } : span) };
  }) },
  { id: 'over_broad_span', expectedCaught: true, mutate: (candidate, source) => replaceAnswer(candidate, (block) => {
    const first = block.spans[0];
    const turn = source?.turns.find((item) => item.id === first?.turn_id);
    if (!first || !turn || first.start === 0 && first.end === turn.text.length) return null;
    return { ...block, spans: block.spans.map((span, index) => index === 0 ? { ...span, start: 0, end: turn.text.length } : span) };
  }) },
  textMutation('dropped_negation', /\bnot\s+/iu, '', false),
  textMutation('relation_swap', /\bThe client calls the server\b/u, 'The server calls the client', false),
  textMutation('paraphrase', /\bUse the cache\b/u, 'Avoid the cache', false),
]);

export function mutateCandidate(id: MutatorId, candidate: QaCandidate, source?: SpanSource): QaCandidate | null {
  return MUTATORS.find((mutator) => mutator.id === id)!.mutate(candidate, source);
}
