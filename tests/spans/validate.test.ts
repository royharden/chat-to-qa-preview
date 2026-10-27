import { describe, expect, it } from 'vitest';
import { validateSpan } from '../../src/lib/spans/validate.ts';
import { isUtf16Boundary } from '../../src/lib/spans/utf16.ts';
import type { Span } from '../../src/lib/spans/span.ts';

const source = { source_revision: 'current', turns: [{ id: 't1', role: 'user', text: 'A😀[EMAIL_1]Z' }, { id: 't2', role: 'tool', text: 'tool' }] };
const span: Span = { turn_id: 't1', start: 1, end: 3, source_revision: 'current' };

describe('UTF-16 rendered-text spans', () => {
  it('uses half-open code-unit offsets and preserves astral characters', () => {
    expect(validateSpan(source, span)).toEqual({ ok: true, text: '😀' });
    expect(isUtf16Boundary(source.turns[0]!.text, 2)).toBe(false);
    expect(validateSpan(source, { ...span, start: 2 }).ok).toBe(false);
    expect(validateSpan(source, { ...span, end: 2 }).ok).toBe(false);
  });
  it('indexes rendered placeholders rather than an internal namespace', () => {
    expect(validateSpan(source, { ...span, start: 3, end: 12 })).toEqual({ ok: true, text: '[EMAIL_1]' });
  });
  it.each([{ start: -1 }, { start: 0.5 }, { start: NaN }, { end: Infinity }, { end: 100 }, { start: 3, end: 3 }])('refuses invalid offsets %j', (change) => {
    expect(validateSpan(source, { ...span, ...change }).ok).toBe(false);
  });
  it('refuses stale revision, absent turn and tool/thinking roles', () => {
    expect(validateSpan(source, { ...span, source_revision: 'old' })).toEqual({ ok: false, reason: 'wrong_revision' });
    expect(validateSpan(source, { ...span, turn_id: 't999' }).ok).toBe(false);
    expect(validateSpan(source, { ...span, turn_id: 't2' })).toEqual({ ok: false, reason: 'ineligible_turn' });
    expect(validateSpan({ ...source, turns: [{ id: 't1', role: 'thinking', text: 'think' }] }, span).ok).toBe(false);
  });
  it('fails duplicate ids and ill-formed UTF-16 closed', () => {
    expect(validateSpan({ ...source, turns: [source.turns[0]!, source.turns[0]!] }, span).ok).toBe(false);
    expect(validateSpan({ ...source, turns: [{ id: 't1', role: 'user', text: '\uD800bad' }] }, span).ok).toBe(false);
  });
});
