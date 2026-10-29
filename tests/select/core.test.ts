import { describe, expect, it } from 'vitest';
import { extractiveCore, rankPairsCore } from '../../src/lib/select/core.ts';
import { selectExtractive } from '../../src/lib/select/extractive.ts';
import { redactSession } from '../../src/lib/redactkit/index.ts';

describe('shared evaluator selector seam', () => {
  it('uses the same K6 implementation for unbranded synthetic evaluator arms', async () => {
    const raw = { turns: [{ id: 't1', role: 'user' as const, text: 'How?' }, { id: 't2', role: 'assistant' as const, text: 'Use the cache.' }] };
    const branded = await redactSession(raw);
    if (!branded.ok) throw new Error('synthetic redaction refused');
    const source = { ...raw, source_revision: branded.source_revision };
    expect(extractiveCore(source)).toEqual(selectExtractive(branded));
    expect(rankPairsCore(source)[0]?.score).toBe(4);
    // @ts-expect-error Structural evaluator sources cannot enter the branded product wrapper.
    expect(selectExtractive(source).ok).toBe(false);
  });
});
