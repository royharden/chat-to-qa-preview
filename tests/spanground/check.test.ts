import { describe, expect, it } from 'vitest';
import type { QaBlock, QaCandidate } from '../../src/lib/select/types.ts';
import { checkBlock, checkCandidate } from '../../src/lib/spanground/check.ts';

const questionText = 'How can I set build7?';
const answerText = 'Use build7 in vite.config.ts. Run build7.';
const source = { source_revision: 'rev', turns: [{ id: 't1', role: 'user', text: questionText }, { id: 't2', role: 'assistant', text: answerText }] };
function block(text = 'Use build7 in vite.config.ts.'): QaBlock {
  return { kind: 'sentence', text, spans: [{ turn_id: 't2', start: 0, end: 'Use build7 in vite.config.ts.'.length, source_revision: 'rev' }] };
}
const candidate: QaCandidate = {
  source_revision: 'rev',
  question: { kind: 'sentence', text: questionText, spans: [{ turn_id: 't1', start: 0, end: questionText.length, source_revision: 'rev' }] },
  answer: [block()],
};

describe('lexical-only grounding gate', () => {
  it('checks question and answer with no semantic-verification claim', () => {
    expect(checkCandidate(source, candidate).ok).toBe(true);
    expect(checkCandidate(source, candidate).label).toBe('lexical-only');
    expect(checkCandidate(source, { ...candidate, question: { ...candidate.question, text: 'How can I set build8?' } }).ok).toBe(false);
  });
  it('rejects two sentence blocks and broad multi-sentence citations', () => {
    expect(checkBlock(source, block('Use build7. Run build7.')).reasons).toContain('invalid_single_block');
    expect(checkBlock(source, { ...block(), spans: [{ ...block().spans[0]!, end: answerText.length }] }).reasons).toContain('over_broad_span');
  });
  it('refuses empty or more than three spans, stale revisions and missing tokens', () => {
    expect(checkBlock(source, { ...block(), spans: [] }).ok).toBe(false);
    expect(checkBlock(source, { ...block(), spans: Array.from({ length: 4 }, () => block().spans[0]!) }).ok).toBe(false);
    expect(checkBlock(source, block('Use build70.')).missing).toContain('build70');
    expect(checkCandidate(source, { ...candidate, source_revision: 'old' }).ok).toBe(false);
  });
  it('requires code equality after LF and trailing-space normalisation', () => {
    const code = '```sh\nrun build7  \n```';
    const codeSource = { source_revision: 'rev', turns: [{ id: 't2', role: 'assistant', text: code }] };
    const good: QaBlock = { kind: 'code', text: '```sh\nrun build7\n```', spans: [{ turn_id: 't2', start: 0, end: code.length, source_revision: 'rev' }] };
    expect(checkBlock(codeSource, good).ok).toBe(true);
    expect(checkBlock(codeSource, { ...good, text: '```sh\nrun build8\n```' }).reasons).toContain('code_not_equal');
    expect(checkBlock(codeSource, { ...good, kind: 'sentence' }).ok).toBe(false);
  });
  it('keeps failures visible and enforces candidate size and block limits', () => {
    const bad = checkCandidate(source, { ...candidate, question: { ...candidate.question, text: 'x'.repeat(501) }, answer: Array.from({ length: 21 }, () => block('x'.repeat(300))) });
    expect(bad.reasons).toEqual(expect.arrayContaining(['question_limit', 'block_limit', 'answer_limit']));
    expect(bad.blocks).toHaveLength(22);
  });
  it.each([
    ['Do not use the cache.', 'Do use the cache.'],
    ['The client calls the server.', 'The server calls the client.'],
    ['Use the cache.', 'Avoid the cache.'],
  ])('documents expected semantic miss: %s', (gold, changed) => {
    const narrowSource = { source_revision: 'rev', turns: [{ id: 't2', role: 'assistant', text: gold }] };
    const changedBlock: QaBlock = { kind: 'sentence', text: changed, spans: [{ turn_id: 't2', start: 0, end: gold.length, source_revision: 'rev' }] };
    expect(changed).not.toBe(gold);
    expect(checkBlock(narrowSource, changedBlock).ok).toBe(true); // Expected NOT caught: lexical evidence is not semantics.
  });
});
