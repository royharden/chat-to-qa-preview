// R0 no-redaction control: an identity, evaluator-only.
import { describe, expect, it } from 'vitest';
import { noRedaction, noRedactionAll } from '../../src/lib/baselines/noRedaction.ts';

describe('R0 noRedaction', () => {
  it('returns its input unchanged', () => {
    const text = 'mail dev.one' + '@' + 'example.test and anything else\n\twith tabs';
    expect(noRedaction(text)).toBe(text);
  });

  it('maps many texts unchanged, in order, as a new array', () => {
    const texts = ['a', '', 'c'];
    const out = noRedactionAll(texts);
    expect(out).toEqual(texts);
    expect(out).not.toBe(texts);
  });
});
