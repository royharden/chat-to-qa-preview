import { describe, expect, it } from 'vitest';
import { isRedactedSession, manualRedact, redactSession, RULES_VERSION, scanPlaceholderEscapes, sourceRevision, verifyRedacted } from '../../src/lib/redactkit/index.ts';
import { escapePlaceholders, newNamespace } from '../../src/lib/redactkit/placeholders.ts';
import type { RedactedSession, RedactedText } from '../../src/lib/redactkit/index.ts';
const email = () => 'reader' + '@example.test';
const session = (text: string) => ({ turns: [{ id: 't1', role: 'user' as const, text }, { id: 't2', role: 'assistant' as const, text: 'Use the setting.' }] });
const highEntropy = () => ['Ab3Cd4Ef5Gh6', 'Ij7Kl8Mn9Op0', 'Qr1St2Uv3Wx4Yz5'].join('');
describe('rendered redaction boundary', () => {
  it('excludes tool/thinking and reviewed exclusions', async () => {
    const input = { turns: [...session(email()).turns, { id: 't3', role: 'tool' as const, text: email() }, { id: 't4', role: 'thinking' as const, text: email() }] };
    const out = await redactSession(input, { excludedTurnIds: new Set(['t1']) });
    expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.turns.map((t) => t.id)).toEqual(['t2']);
  });
  it('brands only engine instances and freezes them', async () => {
    const out = await redactSession(session(email())); expect(out.ok).toBe(true); if (!out.ok) return;
    expect(isRedactedSession(out)).toBe(true); expect(isRedactedSession({ ...out })).toBe(false);
    expect(Object.isFrozen(out.turns[0])).toBe(true); expect(out.turns[0]?.text).toBe('[EMAIL_1]');
  });
  it('escapes forged namespaced and literal placeholders instead of allowing them', async () => {
    const raw = '\u27e6xxxxxx:EMAIL_1\u27e7 [EMAIL_1] ' + email();
    const out = await redactSession(session(raw)); expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.turns[0]?.text).toBe('\u27ecxxxxxx:EMAIL_1\u27ed \uff3bEMAIL_1\uff3d [EMAIL_1]');
    expect(out.placeholders).toEqual(['[EMAIL_1]']);
    expect(scanPlaceholderEscapes(out.turns[0]?.text ?? '').length).toBeGreaterThan(0);
    expect((await verifyRedacted(out.turns, RULES_VERSION)).ok).toBe(false);
  });
  it('manual original offsets remain correct after preceding forged placeholders', async () => {
    const prefix = '\u27e6xxxxxx:EMAIL_1\u27e7 [EMAIL_1] ';
    const raw = prefix + 'private phrase remains';
    const out = await manualRedact(session(raw), {}, { turn_id: 't1', start: prefix.length, end: prefix.length + 14 });
    expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.turns[0]?.text).toBe(escapePlaceholders(prefix) + '[MANUAL_1] remains');
    expect(escapePlaceholders(prefix).length).toBe(prefix.length);
  });
  it('escape length keeps manual offsets stable', () => expect(escapePlaceholders('[EMAIL_1] \u27e6xxxxxx:EMAIL_1\u27e7').length).toBe('[EMAIL_1] \u27e6xxxxxx:EMAIL_1\u27e7'.length));
  it('namespace comes from Web Crypto and is not emitted', () => {
    const a = newNamespace(); const b = newNamespace(); expect(a).toMatch(/^[a-f0-9]{24}$/); expect(a).not.toBe(b);
  });
  it('revision hashes rendered canonical turns, independent of random namespace', async () => {
    const a = await redactSession(session(email())); const b = await redactSession(session(email()));
    expect(a.ok && b.ok).toBe(true); if (!a.ok || !b.ok) return;
    expect(a.source_revision).toBe(b.source_revision);
    expect(a.source_revision).toBe(await sourceRevision(a.turns, RULES_VERSION));
    expect(a.source_revision).toMatch(/^[a-f0-9]{16}$/);
    const c = await redactSession(session('Different text.')); if (c.ok) expect(a.source_revision).not.toBe(c.source_revision);
  });
  it('manual span resolves all of an ambiguous candidate and re-runs', async () => {
    const input = session(highEntropy()); const blocked = await redactSession(input); expect(blocked.ok).toBe(false);
    const out = await manualRedact(input, {}, { turn_id: 't1', start: 0, end: highEntropy().length });
    expect(out.ok).toBe(true); if (out.ok) expect(out.turns[0]?.text).toBe('[MANUAL_1]');
    expect((await manualRedact(input, {}, { turn_id: 't1', start: 0, end: 3 })).ok).toBe(false);
  });
  it('manual edit changes revision and invalid manual spans refuse', async () => {
    const input = session('Use the setting.'); const a = await redactSession(input); const b = await manualRedact(input, {}, { turn_id: 't1', start: 4, end: 7 });
    if (a.ok && b.ok) expect(a.source_revision).not.toBe(b.source_revision); else throw new Error('unexpected findings');
    for (const span of [{ turn_id: 't9', start: 0, end: 1 }, { turn_id: 't1', start: -1, end: 2 }, { turn_id: 't1', start: 2, end: 1 }]) expect((await manualRedact(input, {}, span)).ok).toBe(false);
    expect((await manualRedact(session('\u{1f600}'), {}, { turn_id: 't1', start: 0, end: 1 })).ok).toBe(false);
  });
  it('verification re-runs detectors and refuses bad version, ids, role and oversized turns', async () => {
    const out = await redactSession(session(email())); if (!out.ok) throw new Error('unexpected findings');
    const verified = await verifyRedacted(out.turns, RULES_VERSION); expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.source_revision).toBe(out.source_revision);
    expect((await verifyRedacted(out.turns, 'wrong')).ok).toBe(false);
    expect((await verifyRedacted(session(email()).turns, RULES_VERSION)).ok).toBe(false);
    expect((await verifyRedacted([{ id: 't1', role: 'tool', text: 'hello' }], RULES_VERSION)).ok).toBe(false);
    expect((await verifyRedacted([out.turns[0]!, out.turns[0]!], RULES_VERSION)).ok).toBe(false);
    expect((await verifyRedacted([{ id: 't1', role: 'user', text: 'x'.repeat(100001) }], RULES_VERSION)).ok).toBe(false);
    expect((await verifyRedacted([{ id: 't1', role: 'user', text: '[BOGUS_1]' }], RULES_VERSION)).ok).toBe(false);
  });
  it('redacts one JSON unicode-escape layer using original offsets', async () => {
    const raw = 'prefix {"value":"' + '\\u0073\\u006b-' + 'a'.repeat(24) + '"} suffix';
    const out = await redactSession(session(raw)); expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.turns[0]?.text).toBe('prefix {"value":"[TOKEN_1]"} suffix');
    expect(out.turns[0]?.text).not.toContain('u0073');
  });
  it('generated lengths form a property-test source without execution in Dirty Mode', async () => {
    for (let n = 1; n < 40; n++) {
      const input = session('x'.repeat(n) + ' ' + email() + ' ' + 'y'.repeat(n));
      const a = await redactSession(input); const b = await redactSession(input);
      if (!a.ok || !b.ok) throw new Error('unexpected findings');
      expect(a.source_revision).toBe(b.source_revision); expect(a.turns[0]?.text).not.toContain(email());
      expect((await verifyRedacted(a.turns, RULES_VERSION)).ok).toBe(true);
    }
  });
});
describe('placement traps have explicit test sources', () => {
  const wrappers: readonly [string, (v: string) => string][] = [
    ['split across lines', (v) => 'Bea' + 'rer\n' + v],
    ['inside code', (v) => '```txt\n' + v + '\n```'],
    ['stack trace', (v) => 'at run (' + v + ':12:34)'],
    ['details', (v) => '<details>\n' + v + '\n</details>'],
    ['tool-looking block', (v) => 'TOOL RESULT:\n' + v],
    ['echoed question', (v) => 'Should I use ' + v + '?'],
    ['signature', (v) => 'Thanks, Demo Person\n' + v],
    ['URL query', (v) => 'https://docs.test/?token=' + v],
    ['repeated', (v) => v + ' ' + v],
    ['adjacent decoy', (v) => 'version 1.2.3.4 ' + v],
    ['escaped in JSON', (v) => JSON.stringify({ token: v })],
  ];
  it.each(wrappers)('%s', async (_label, wrap) => {
    const secret = 'sk' + '-' + 'a'.repeat(24); const out = await redactSession(session(wrap(secret)));
    expect(out.ok).toBe(true); if (out.ok) expect(out.turns[0]?.text).not.toContain(secret);
  });
  it('mid-token line splits remain an explicit expected miss', () => {
    // This is not the supported auth-whitespace trap: the identifier itself is interrupted.
    const input = 's' + '\nk-' + 'a'.repeat(24);
    expect(input.includes('sk' + '-')).toBe(false);
  });
});
function onlyRedacted(_text: RedactedText): void { /* type boundary */ }
function onlySession(_session: RedactedSession): void { /* type boundary */ }
if (false) {
  // @ts-expect-error Raw strings cannot cross the redacted-text boundary.
  onlyRedacted('raw input');
  // @ts-expect-error Plain sessions have no private session brand.
  onlySession(session('raw input'));
}
