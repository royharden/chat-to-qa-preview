import { describe, expect, it } from 'vitest';
import { normaliseCode, SPLITTER_VERSION, splitBlocks } from '../../src/lib/spanground/split.ts';

describe('versioned conservative splitter', () => {
  it('keeps versions, dotted filenames and inline code intact', () => {
    const text = 'Use v5.4.2 in vite.config.ts. Run `call(a.b)` next!';
    const result = splitBlocks(text);
    expect(SPLITTER_VERSION).toBe('s47.conservative-en.v1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((block) => block.text)).toEqual(['Use v5.4.2 in vite.config.ts.', 'Run `call(a.b)` next!']);
    for (const block of result.blocks) expect(text.slice(block.start, block.end)).toBe(block.text);
  });
  it('preserves an entire fenced block as one unit, including sentence-like lines', () => {
    const text = 'Use this.\n\n```ts\nconst x = "Hello. Bye.";\n```\n\nRun it.';
    const result = splitBlocks(text);
    expect(result.ok && result.blocks.map((block) => block.kind)).toEqual(['sentence', 'code', 'sentence']);
    expect(splitBlocks('```ts\nunfinished').ok).toBe(false);
    expect(splitBlocks('~~~\nx\n~~~').ok).toBe(true);
  });
  it('normalises only line endings and trailing spaces for code equality', () => {
    expect(normaliseCode('```\r\nx  \r\n```\r\n')).toBe('```\nx\n```');
    expect(normaliseCode('```\n x\n```')).not.toBe(normaliseCode('```\nx\n```'));
  });
});
