import { describe, expect, it } from 'vitest';
import { redactSession } from '../../src/lib/redactkit/index.ts';
import { rankPairs, selectExtractive } from '../../src/lib/select/extractive.ts';
import { checkCandidate } from '../../src/lib/spanground/check.ts';
import type { RedactedSession } from '../../src/lib/redactkit/brand.ts';

async function session(texts: readonly string[]): Promise<RedactedSession> {
  const result = await redactSession({ turns: texts.map((text, index) => ({ id: `t${index + 1}`, role: index % 2 === 0 ? 'user' as const : 'assistant' as const, text })) });
  if (!result.ok) throw new Error('synthetic redaction refused');
  return result;
}

describe('K6 scored extractive selector', () => {
  it('applies exact pair weights and ranks later ties first', async () => {
    const input = await session(['How do I fix it?', 'Use the cache.', 'Why is it slow?', 'Run the build.']);
    const pairs = rankPairs(input);
    expect(pairs.map((pair) => [pair.user_turn_id, pair.question_score, pair.score])).toEqual([['t3', 3, 4], ['t1', 3, 4]]);
    const result = selectExtractive(input);
    expect(result.ok && result.candidate.question.text).toBe('Why is it slow?');
  });
  it('gives code +2, whole-word recommendation +1, and ambiguous first word -1', async () => {
    const input = await session(['This?', '```sh\necho hi\n```', 'What now', 'Use this.']);
    expect(rankPairs(input).map((pair) => [pair.user_turn_id, pair.question_score, pair.score])).toEqual([['t1', 1, 3], ['t3', 1, 2]]);
    const noVerb = await session(['How?', 'Useful and running are descriptions.']);
    expect(selectExtractive(noVerb)).toEqual({ ok: false, reason: 'no_qualifying_pair' });
  });
  it('uses first following assistant only, and never crosses the next user', async () => {
    const result = await redactSession({ turns: [
      { id: 't1', role: 'user', text: 'How?' }, { id: 't2', role: 'assistant', text: 'No advice.' },
      { id: 't3', role: 'assistant', text: 'Use this.' }, { id: 't4', role: 'user', text: 'Why?' },
      { id: 't5', role: 'user', text: 'unqualified' }, { id: 't6', role: 'assistant', text: 'Run this.' },
    ] });
    if (!result.ok) throw new Error('synthetic redaction refused');
    expect(rankPairs(result)).toEqual([]);
  });
  it('selects the first question sentence or otherwise the first sentence, citing original offsets', async () => {
    const result = selectExtractive(await session(['Context first. What can I do? Why later?', 'Use the cache. Run the build.']));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.question.text).toBe('What can I do?');
    expect(result.candidate.question.spans[0]?.start).toBe(15);
    const fallback = selectExtractive(await session(['How to proceed. More context.', 'Use this.']));
    expect(fallback.ok && fallback.candidate.question.text).toBe('How to proceed.');
  });
  it('takes at most six complete blocks without truncating sentences or code', async () => {
    const input = await session(['How?', Array.from({ length: 8 }, (_, index) => `Use build${index}.`).join(' ')]);
    const result = selectExtractive(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.answer).toHaveLength(6);
    expect(result.candidate.answer.at(-1)?.text).toBe('Use build5.');
    expect(checkCandidate(input, result.candidate).ok).toBe(true);
  });
  it('abstains rather than slicing a first block or a long question', async () => {
    expect(selectExtractive(await session([`How ${'a '.repeat(250)}?`, 'Use this.']))).toEqual({ ok: false, reason: 'question_limit' });
    expect(selectExtractive(await session(['How?', `Use ${'a '.repeat(3000)}.`]))).toEqual({ ok: false, reason: 'answer_limit' });
    const input = await session(['How?', `Use this.\n\n\`\`\`\n${'a '.repeat(3000)}\n\`\`\``]);
    const result = selectExtractive(input);
    expect(result.ok && result.candidate.answer.map((block) => block.text)).toEqual(['Use this.']);
  });
  it('excludes tool/thinking and explicitly excluded turns through redaction views', async () => {
    const result = await redactSession({ turns: [
      { id: 't1', role: 'user', text: 'How?' }, { id: 't2', role: 'tool', text: 'Use tool output.' },
      { id: 't3', role: 'thinking', text: 'Use private thought.' }, { id: 't4', role: 'assistant', text: 'Use this.' },
      { id: 't5', role: 'user', text: 'Why?' }, { id: 't6', role: 'assistant', text: 'Run this.' },
    ] }, { excludedTurnIds: new Set(['t6']) });
    if (!result.ok) throw new Error('synthetic redaction refused');
    expect(rankPairs(result).map((pair) => pair.assistant_turn_id)).toEqual(['t4']);
  });
});
